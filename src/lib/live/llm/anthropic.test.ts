import { afterEach, describe, expect, it, vi } from "vitest";
import { ANTHROPIC_BASE, ANTHROPIC_VERSION, anthropicLLM, classifyAnthropicError, DEFAULT_MAX_TOKENS, parseAnthropicResponse } from "./anthropic";
import { isCutOff, isRefusal, LLMError } from "./types";

const KEY = "sk-ant-api03-TEST-secret-key-0123456789abcdef";
const ok = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", "request-id": "req_011ok", ...headers } });
const fail = (status: number, type: string, message: string, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ type: "error", error: { type, message, ...extra }, request_id: "req_011CSHoEeqs5C35K2UUqR7Fy" }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

/** A Messages API reply as the docs describe it: thinking first (empty by default on Opus 5.5), then text blocks. */
const answer = {
  id: "msg_01",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [
    { type: "thinking", thinking: "", signature: "sig" },
    { type: "redacted_thinking", data: "opaque" },
    { type: "text", text: '{"hypotheses": ' },
    { type: "text", text: "[]}" },
  ],
  stop_reason: "end_turn",
  stop_sequence: null,
  stop_details: null,
  usage: { input_tokens: 120, output_tokens: 340, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens_details: { thinking_tokens: 200 } },
};

const noWait = { retries: 3, baseDelayMs: 1, maxDelayMs: 5 };
const sleep = vi.fn(async () => {});
const call = (fetch: typeof globalThis.fetch, model = "claude-opus-5-5") => anthropicLLM({ apiKey: KEY, model, fetch, retry: noWait, sleep });

afterEach(() => vi.restoreAllMocks());

describe("Claude adapter: request shape", () => {
  it("POSTs /v1/messages with x-api-key and anthropic-version headers, the system prompt top-level, and no key in the URL", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(answer));
    const res = await call(fetch).complete({
      system: "Plan carefully.",
      messages: [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Draft" },
        { role: "user", content: "Fix it" },
      ],
      json: true,
      maxTokens: 8192,
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(url).toBe(`${ANTHROPIC_BASE}/messages`);
    expect(String(url)).not.toContain(KEY);
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(KEY);
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(ANTHROPIC_VERSION).toBe("2023-06-01");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers).not.toHaveProperty("anthropic-workspace-id");
    expect(headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "claude-opus-5-5",
      max_tokens: 8192,
      system: "Plan carefully.",
      messages: [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Draft" },
        { role: "user", content: "Fix it" },
      ],
    });
    // Text blocks joined; thinking and redacted_thinking are not the answer.
    expect(res).toEqual({ text: '{"hypotheses": []}', usage: { inputTokens: 120, outputTokens: 340 }, model: "claude-opus-5-5", finishReason: "end_turn" });
  });

  it("JSON mode adds nothing (no schema-free JSON mode, no prefill, no thinking field)", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(answer));
    const req = { system: "s", messages: [{ role: "user" as const, content: "x" }], maxTokens: 100 };
    await call(fetch).complete({ ...req, json: true });
    await call(fetch).complete(req);
    const [withJson, without] = fetch.mock.calls.map((c) => JSON.parse(String(c[1]?.body)));
    expect(withJson).toEqual(without);
    expect(withJson).not.toHaveProperty("thinking");
    expect(withJson).not.toHaveProperty("output_config");
    expect(withJson.messages.at(-1).role).toBe("user");
  });

  it("sends output_config.effort only when asked and only to a model that takes it (Opus 5.5 yes, Haiku 4.5 no)", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(answer));
    const req = { system: "s", messages: [{ role: "user" as const, content: "x" }], effort: "medium" as const };
    await call(fetch, "claude-opus-5-5").complete(req);
    await call(fetch, "claude-haiku-4-5").complete(req);
    await call(fetch, "claude-opus-5-5").complete({ ...req, effort: undefined });
    const [opus, haiku, none] = fetch.mock.calls.map((c) => JSON.parse(String(c[1]?.body)));
    expect(opus.output_config).toEqual({ effort: "medium" });
    expect(haiku).not.toHaveProperty("output_config");
    expect(none).not.toHaveProperty("output_config");
  });

  it("sends temperature only when asked, clamped to the API's 0..1; leaves out an empty system prompt; max_tokens is always set", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(answer));
    const llm = call(fetch, "claude-haiku-4-5");
    await llm.complete({ system: "", messages: [{ role: "user", content: "1+1" }] });
    await llm.complete({ system: "Helper", messages: [{ role: "user", content: "1+1" }], temperature: 0.2, maxTokens: 2048 });
    await llm.complete({ system: "Helper", messages: [{ role: "user", content: "1+1" }], temperature: 1.4 });
    const bodies = fetch.mock.calls.map((c) => JSON.parse(String(c[1]?.body)));
    expect(bodies[0]).toEqual({ model: "claude-haiku-4-5", max_tokens: DEFAULT_MAX_TOKENS, messages: [{ role: "user", content: "1+1" }] });
    expect(bodies[1]).toMatchObject({ system: "Helper", temperature: 0.2, max_tokens: 2048 });
    expect(bodies[2].temperature).toBe(1);
  });

  it("sends anthropic-workspace-id for a key that is not scoped to one workspace", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(answer));
    await anthropicLLM({ apiKey: KEY, model: "m", workspaceId: "wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ", fetch }).complete({ system: "", messages: [{ role: "user", content: "x" }] });
    expect((fetch.mock.calls[0][1]?.headers as Record<string, string>)["anthropic-workspace-id"]).toBe("wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ");
  });
});

describe("Claude adapter: responses", () => {
  it("counts cache reads and writes as input (the docs' total input) and output_tokens as is (thinking included)", () => {
    const r = parseAnthropicResponse(
      { ...answer, usage: { input_tokens: 50, cache_creation_input_tokens: 1000, cache_read_input_tokens: 2000, output_tokens: 70 } },
      "claude-opus-5-5",
    );
    expect(r.usage).toEqual({ inputTokens: 3050, outputTokens: 70 });
    expect(parseAnthropicResponse({ content: [], stop_reason: "end_turn" }, "m").usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("ignores every block that is not text, and reports the model that answered", () => {
    const r = parseAnthropicResponse(
      {
        model: "claude-haiku-4-5-20251001",
        content: [
          { type: "text", text: "Step 1: 6 × 7 = 42.\n" },
          { type: "thinking", thinking: "a summary", signature: "s" },
          { type: "tool_use", id: "t", name: "calc", input: {} },
          { type: "text", text: "Answer: 42" },
          { type: "text" },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 12 },
      },
      "claude-haiku-4-5",
    );
    expect(r).toEqual({ text: "Step 1: 6 × 7 = 42.\nAnswer: 42", usage: { inputTokens: 10, outputTokens: 12 }, model: "claude-haiku-4-5-20251001", finishReason: "end_turn" });
    // No model field: the configured id stands in.
    expect(parseAnthropicResponse({ content: [], stop_reason: null }, "claude-haiku-4-5").model).toBe("claude-haiku-4-5");
  });

  it("a reply stopped by max_tokens comes back with that finish reason and its billed tokens, like Gemini's MAX_TOKENS", async () => {
    const cut = { ...answer, content: [{ type: "text", text: '{"hypotheses": [' }], stop_reason: "max_tokens", usage: { input_tokens: 900, output_tokens: 16000 } };
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(cut));
    const res = await call(fetch).complete({ system: "", messages: [{ role: "user", content: "x" }], maxTokens: 16000 });
    expect(res).toEqual({ text: '{"hypotheses": [', usage: { inputTokens: 900, outputTokens: 16000 }, model: "claude-opus-5-5", finishReason: "max_tokens" });
    expect(fetch).toHaveBeenCalledTimes(1); // not retried
    expect(isCutOff(res.finishReason)).toBe(true);
    const full = parseAnthropicResponse({ ...answer, stop_reason: "model_context_window_exceeded" }, "m");
    expect(full.finishReason).toBe("model_context_window_exceeded");
    expect(isCutOff(full.finishReason)).toBe(true);
  });

  it("a refusal is an answer that says no, with its category, not an error", () => {
    const r = parseAnthropicResponse(
      { ...answer, content: [{ type: "text", text: "I can't help with that." }], stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: null } },
      "m",
    );
    expect(r).toMatchObject({ text: "I can't help with that.", finishReason: "refusal:cyber" });
    expect(isRefusal(r.finishReason)).toBe(true);
    expect(parseAnthropicResponse({ content: [], stop_reason: "refusal", stop_details: null }, "m").finishReason).toBe("refusal");
  });

  it("a body that is not JSON, or has no content array, is a bad response and is not retried", async () => {
    expect(() => parseAnthropicResponse("nope", "m")).toThrow(/not JSON/);
    expect(() => parseAnthropicResponse({ type: "message", usage: { input_tokens: 3, output_tokens: 1 } }, "m")).toThrow(/no content blocks/);
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("<html>oops</html>", { status: 200 }));
    await expect(call(fetch).complete({ system: "", messages: [] })).rejects.toMatchObject({ kind: "bad-response" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("Claude adapter: error classification", () => {
  const kind = (status: number, type: string, message = "error", retryAfter: string | null = null, extra: Record<string, unknown> = {}) =>
    classifyAnthropicError(status, { type: "error", error: { type, message, ...extra }, request_id: "req_011abc" }, retryAfter, KEY);

  it("maps every documented error type onto the engine's kinds", () => {
    expect(kind(400, "invalid_request_error", "messages: field required").kind).toBe("bad-request");
    expect(kind(401, "authentication_error", "invalid x-api-key").kind).toBe("auth");
    expect(kind(402, "billing_error", "check your payment details").kind).toBe("quota");
    expect(kind(403, "permission_error", "Your API key does not have permission").kind).toBe("auth");
    expect(kind(404, "not_found_error", "model: claude-opus-9").kind).toBe("model-not-found");
    expect(kind(413, "request_too_large", "Request exceeds the maximum allowed number of bytes.").kind).toBe("bad-request");
    expect(kind(429, "rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit", "12")).toMatchObject({ kind: "rate-limit", retryAfterMs: 12_000 });
    expect(kind(500, "api_error", "Internal server error").kind).toBe("server");
    expect(kind(504, "timeout_error", "Request timed out").kind).toBe("server");
    expect(kind(529, "overloaded_error", "Overloaded")).toMatchObject({ kind: "server", status: 529 });
    expect(kind(409, "conflict_error", "conflict").kind).toBe("bad-request");
  });

  it("tells a spend limit from a rate limit: the spend-cap 429 has error_code and no retry-after; a limit you set is a 400", () => {
    const cap = kind(429, "rate_limit_error", "You have reached your API usage limits.", null, { details: { error_code: "enforced_spend_limit_reached" } });
    expect(cap.kind).toBe("quota");
    expect(kind(400, "invalid_request_error", "You have reached your specified API usage limits. You will regain access on 2026-11-01.").kind).toBe("quota");
    expect(kind(400, "invalid_request_error", "You have reached your specified workspace API usage limits.").kind).toBe("quota");
    // A 429 without error_code is a rate limit even without retry-after (the backoff then applies).
    expect(kind(429, "rate_limit_error", "slow down")).toMatchObject({ kind: "rate-limit", retryAfterMs: null });
  });

  it("a wrong workspace id is a credentials problem, not a missing model", () => {
    expect(kind(404, "not_found_error", "Workspace `wrkspc_x` not found.").kind).toBe("auth");
  });

  it("names the status, type and request id, and survives a body that is not JSON", () => {
    expect(kind(429, "rate_limit_error", "slow down").message).toBe("Claude API 429 rate_limit_error (req_011abc): slow down");
    const header = classifyAnthropicError(500, { __raw: "<html>bad gateway</html>" }, null, KEY, "req_fromheader");
    expect(header).toMatchObject({ kind: "server", message: "Claude API 500 (req_fromheader): <html>bad gateway</html>" });
    expect(classifyAnthropicError(503, null, null, KEY).message).toBe("Claude API 503: server error");
    // A request id that does not look like one is left out rather than echoed.
    expect(classifyAnthropicError(500, null, null, KEY, `req_${KEY}`).message).not.toContain(KEY);
  });
});

describe("Claude adapter: retries and timeouts", () => {
  it("retries a 429 and a 529, honouring retry-after up to the cap, then succeeds", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(fail(429, "rate_limit_error", "slow down", { "retry-after": "30" }))
      .mockResolvedValueOnce(fail(529, "overloaded_error", "Overloaded"))
      .mockResolvedValueOnce(ok(answer));
    const waits: number[] = [];
    const llm = anthropicLLM({ apiKey: KEY, model: "m", fetch, retry: { retries: 3, baseDelayMs: 100, maxDelayMs: 1500 }, sleep: async (ms) => void waits.push(ms) });
    const res = await llm.complete({ system: "", messages: [{ role: "user", content: "x" }] });
    expect(res.text).toBe('{"hypotheses": []}');
    expect(fetch).toHaveBeenCalledTimes(3);
    // The API asked for 30 s; the wait is capped at 1.5 s. Then exponential backoff (529 has no retry-after).
    expect(waits).toEqual([1500, 200]);
  });

  it("uses a shorter retry-after as given", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(fail(429, "rate_limit_error", "slow", { "retry-after": "2" })).mockResolvedValueOnce(ok(answer));
    const waits: number[] = [];
    await anthropicLLM({ apiKey: KEY, model: "m", fetch, retry: { retries: 1, baseDelayMs: 100, maxDelayMs: 20_000 }, sleep: async (ms) => void waits.push(ms) }).complete({
      system: "",
      messages: [{ role: "user", content: "x" }],
    });
    expect(waits).toEqual([2000]);
  });

  it("does not retry auth, permission, billing, spend cap, unknown model or bad requests", async () => {
    for (const res of [
      () => fail(401, "authentication_error", "invalid x-api-key"),
      () => fail(403, "permission_error", "no"),
      () => fail(402, "billing_error", "no credit"),
      () => fail(429, "rate_limit_error", "monthly cap", {}, { details: { error_code: "enforced_spend_limit_reached" } }),
      () => fail(404, "not_found_error", "model: x"),
      () => fail(400, "invalid_request_error", "temperature: not supported for this model"),
      () => fail(413, "request_too_large", "too big"),
    ]) {
      const fetch = vi.fn<typeof globalThis.fetch>(async () => res());
      await expect(call(fetch).complete({ system: "", messages: [] })).rejects.toBeInstanceOf(LLMError);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("gives up after the retries run out on a server error", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => fail(500, "api_error", "Internal server error"));
    await expect(call(fetch).complete({ system: "", messages: [] })).rejects.toMatchObject({ kind: "server", status: 500 });
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("a slow API times out; a cancelled call is aborted; neither is retried", async () => {
    const hang = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );
    const llm = call(hang);
    await expect(llm.complete({ system: "", messages: [], timeoutMs: 20 })).rejects.toMatchObject({ kind: "timeout" });
    const ctrl = new AbortController();
    const p = llm.complete({ system: "", messages: [], signal: ctrl.signal, timeoutMs: 10_000 });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ kind: "aborted" });
    expect(hang).toHaveBeenCalledTimes(2);
  });

  it("cancelling while it waits to retry stops at once", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => fail(529, "overloaded_error", "Overloaded"));
    const ctrl = new AbortController();
    const waiting = vi.fn();
    const llm = anthropicLLM({
      apiKey: KEY,
      model: "m",
      fetch,
      retry: { retries: 3, baseDelayMs: 1000, maxDelayMs: 1000 },
      sleep: (_ms, signal) =>
        new Promise((_, reject) => {
          waiting();
          signal?.addEventListener("abort", () => reject(signal.reason));
        }),
    });
    const p = llm.complete({ system: "", messages: [], signal: ctrl.signal });
    await vi.waitFor(() => expect(waiting).toHaveBeenCalledTimes(1));
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ kind: "aborted" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("Claude adapter: the key never leaves the request header", () => {
  it("is redacted when the API echoes it, and nothing is logged", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const fetch = vi.fn<typeof globalThis.fetch>(async () => fail(401, "authentication_error", `invalid x-api-key: ${KEY}`));
    const err = await call(fetch).complete({ system: "", messages: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe("auth");
    expect(err.message).not.toContain(KEY);
    expect(err.message).toContain("[redacted]");
    expect(JSON.stringify(err)).not.toContain(KEY);
    expect(String(err.stack)).not.toContain(KEY);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it("is redacted from network errors and from a non-JSON error body", async () => {
    const net = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError(`fetch failed for ${KEY}`);
    });
    const e1 = await call(net).complete({ system: "", messages: [] }).catch((e) => e);
    expect(e1.kind).toBe("network");
    expect(e1.message).not.toContain(KEY);
    const raw = vi.fn<typeof globalThis.fetch>(async () => new Response(`upstream said ${KEY}`, { status: 502 }));
    const e2 = await call(raw).complete({ system: "", messages: [] }).catch((e) => e);
    expect(e2.kind).toBe("server");
    expect(e2.message).not.toContain(KEY);
    expect(raw).toHaveBeenCalledTimes(4);
  });
});
