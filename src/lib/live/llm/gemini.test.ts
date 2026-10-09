import { describe, expect, it, vi } from "vitest";
import { classifyGeminiError, GEMINI_BASE, geminiLLM, parseGeminiResponse } from "./gemini";
import { LLMError } from "./types";

const KEY = "AIzaTEST-secret-key-0123456789";
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const fail = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const answer = {
  candidates: [
    {
      content: { role: "model", parts: [{ text: "thinking about it", thought: true }, { text: "Answer: " }, { text: "42" }] },
      finishReason: "STOP",
    },
  ],
  usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, thoughtsTokenCount: 30, totalTokenCount: 47 },
  modelVersion: "gemini-3.5-flash-lite-001",
};

const noWait = { retries: 3, baseDelayMs: 1, maxDelayMs: 5 };
const sleep = vi.fn(async () => {});

describe("Gemini adapter: request shape", () => {
  it("POSTs generateContent with the key in a header, never in the URL", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(answer));
    const llm = geminiLLM({ apiKey: KEY, model: "gemini-3.8-flash", fetch, sleep });
    const res = await llm.complete({
      system: "Be careful.",
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Plan" },
      ],
      json: true,
      temperature: 0.2,
      maxTokens: 512,
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${GEMINI_BASE}/models/gemini-3.8-flash:generateContent`);
    expect(String(url)).not.toContain(KEY);
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe(KEY);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      systemInstruction: { parts: [{ text: "Be careful." }] },
      contents: [
        { role: "user", parts: [{ text: "Hi" }] },
        { role: "model", parts: [{ text: "Hello" }] },
        { role: "user", parts: [{ text: "Plan" }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: "application/json" },
    });
    // Thought parts are not the answer; thinking tokens count as output.
    expect(res).toEqual({ text: "Answer: 42", usage: { inputTokens: 12, outputTokens: 35 }, model: "gemini-3.5-flash-lite-001", finishReason: "STOP" });
  });

  it("leaves out what was not asked for (no JSON mode, no temperature)", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(answer));
    await geminiLLM({ apiKey: KEY, model: "m", fetch }).complete({ system: "", messages: [{ role: "user", content: "x" }] });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ contents: [{ role: "user", parts: [{ text: "x" }] }], generationConfig: {} });
  });

  it("encodes the model id into the path", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => ok(answer));
    await geminiLLM({ apiKey: KEY, model: "a/b?c", fetch }).complete({ system: "", messages: [{ role: "user", content: "x" }] });
    expect(fetch.mock.calls[0][0]).toBe(`${GEMINI_BASE}/models/a%2Fb%3Fc:generateContent`);
  });
});

describe("Gemini adapter: responses", () => {
  it("a blocked prompt is an empty answer with the block reason, not an error", () => {
    const r = parseGeminiResponse({ promptFeedback: { blockReason: "SAFETY" }, usageMetadata: { promptTokenCount: 3 } }, "m");
    expect(r).toEqual({ text: "", usage: { inputTokens: 3, outputTokens: 0 }, model: "m", finishReason: "BLOCKED:SAFETY" });
  });

  it("no candidates and no reason is a bad response", () => {
    expect(() => parseGeminiResponse({}, "m")).toThrow(LLMError);
    expect(() => parseGeminiResponse("nope", "m")).toThrow(/not JSON/);
  });

  it("a body that is not JSON is a bad response", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("<html>oops</html>", { status: 200 }));
    await expect(geminiLLM({ apiKey: KEY, model: "m", fetch }).complete({ system: "", messages: [] })).rejects.toMatchObject({ kind: "bad-response" });
  });
});

describe("Gemini adapter: error classification", () => {
  it("bad key → auth", () => {
    const e = classifyGeminiError(
      400,
      { error: { code: 400, status: "INVALID_ARGUMENT", message: "API key not valid. Please pass a valid API key.", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID" }] } },
      null,
      KEY,
    );
    expect(e.kind).toBe("auth");
    expect(classifyGeminiError(403, { error: { status: "PERMISSION_DENIED", message: "denied" } }, null, KEY).kind).toBe("auth");
  });

  it("unknown model → model-not-found", () => {
    expect(classifyGeminiError(404, { error: { status: "NOT_FOUND", message: "models/x is not found" } }, null, KEY).kind).toBe("model-not-found");
  });

  it("429 per minute → rate-limit with the server's retry delay; per day or limit 0 → quota", () => {
    const perMinute = classifyGeminiError(
      429,
      {
        error: {
          status: "RESOURCE_EXHAUSTED",
          message: "You exceeded your current quota.",
          details: [
            { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] },
            { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "41s" },
          ],
        },
      },
      null,
      KEY,
    );
    expect(perMinute.kind).toBe("rate-limit");
    expect(perMinute.retryAfterMs).toBe(41_000);
    const perDay = classifyGeminiError(
      429,
      { error: { details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } },
      null,
      KEY,
    );
    expect(perDay.kind).toBe("quota");
    expect(classifyGeminiError(429, { error: { message: "Quota exceeded for metric: x, limit: 0, model: y" } }, null, KEY).kind).toBe("quota");
    expect(classifyGeminiError(429, {}, "7", KEY).retryAfterMs).toBe(7000);
  });

  it("5xx → server; other 4xx → bad-request", () => {
    expect(classifyGeminiError(503, { error: { status: "UNAVAILABLE", message: "overloaded" } }, null, KEY).kind).toBe("server");
    expect(classifyGeminiError(400, { error: { status: "INVALID_ARGUMENT", message: "bad field" } }, null, KEY).kind).toBe("bad-request");
  });

  it("never puts the key in an error, even when the provider echoes it", async () => {
    const echo = { error: { code: 400, status: "INVALID_ARGUMENT", message: `API key not valid: ${KEY}` } };
    const fetch = vi.fn<typeof globalThis.fetch>(async () => fail(400, echo));
    const err = await geminiLLM({ apiKey: KEY, model: "m", fetch }).complete({ system: "", messages: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe("auth");
    expect(err.message).not.toContain(KEY);
    expect(err.message).toContain("[redacted]");
    expect(JSON.stringify(err)).not.toContain(KEY);
    expect(String(err.stack)).not.toContain(KEY);
  });
});

describe("Gemini adapter: retries and timeouts", () => {
  it("retries a 429 and a 503, then succeeds", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(fail(429, { error: { message: "slow down", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "2s" }] } }))
      .mockResolvedValueOnce(fail(503, { error: { message: "busy" } }))
      .mockResolvedValueOnce(ok(answer));
    const waits: number[] = [];
    const llm = geminiLLM({ apiKey: KEY, model: "m", fetch, retry: { retries: 3, baseDelayMs: 100, maxDelayMs: 1500 }, sleep: async (ms) => void waits.push(ms) });
    const res = await llm.complete({ system: "", messages: [{ role: "user", content: "x" }] });
    expect(res.text).toBe("Answer: 42");
    expect(fetch).toHaveBeenCalledTimes(3);
    // The provider asked for 2 s; the wait is capped at 1.5 s. Then exponential backoff.
    expect(waits).toEqual([1500, 200]);
  });

  it("does not retry auth, quota or bad requests", async () => {
    for (const [status, body] of [
      [401, { error: { message: "no" } }],
      [429, { error: { details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "PerDay" }] }] } }],
      [400, { error: { message: "bad" } }],
    ] as const) {
      const fetch = vi.fn<typeof globalThis.fetch>(async () => fail(status, body));
      await expect(geminiLLM({ apiKey: KEY, model: "m", fetch, retry: noWait, sleep }).complete({ system: "", messages: [] })).rejects.toBeInstanceOf(LLMError);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it("gives up after the retries run out", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => fail(500, { error: { message: "down" } }));
    await expect(geminiLLM({ apiKey: KEY, model: "m", fetch, retry: noWait, sleep }).complete({ system: "", messages: [] })).rejects.toMatchObject({ kind: "server" });
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("a slow provider times out; a cancelled call is aborted; neither is retried", async () => {
    const hang = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );
    const llm = geminiLLM({ apiKey: KEY, model: "m", fetch: hang, retry: noWait, sleep });
    await expect(llm.complete({ system: "", messages: [], timeoutMs: 20 })).rejects.toMatchObject({ kind: "timeout" });
    const ctrl = new AbortController();
    const p = llm.complete({ system: "", messages: [], signal: ctrl.signal, timeoutMs: 10_000 });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ kind: "aborted" });
    expect(hang).toHaveBeenCalledTimes(2);
  });

  it("a network failure is typed and keeps the key out", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError(`fetch failed for ${KEY}`);
    });
    const err = await geminiLLM({ apiKey: KEY, model: "m", fetch, retry: noWait, sleep }).complete({ system: "", messages: [] }).catch((e) => e);
    expect(err.kind).toBe("network");
    expect(err.message).not.toContain(KEY);
  });
});
