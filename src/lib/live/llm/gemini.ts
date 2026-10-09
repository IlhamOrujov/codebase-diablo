import "server-only";
import {
  DEFAULT_RETRY,
  durationMs,
  isObject,
  postJson,
  retryAfterHeader,
  safeMessage,
  sleep,
  withRetries,
  type Fetch,
  type RetryPolicy,
  type Sleep,
} from "./http";
import { LLMError, type LLM, type LLMRequest, type LLMResponse } from "./types";

/**
 * Gemini API adapter (Google AI Studio keys), plain fetch, no SDK.
 *
 * POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * The key travels in the x-goog-api-key header, never in the URL, so it cannot
 * end up in a log line or an error message.
 *
 * Request: systemInstruction, contents (role "user" | "model"), generationConfig
 * (temperature, maxOutputTokens, responseMimeType "application/json" for JSON).
 * Thinking is left at the model's default; maxOutputTokens covers thinking and
 * answer together, so callers give the reasoning model room.
 */
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiOptions {
  apiKey: string;
  model: string;
  fetch?: Fetch;
  retry?: RetryPolicy;
  sleep?: Sleep;
  /** Default per-call timeout (ms). */
  timeoutMs?: number;
}

export function geminiRequestBody(req: LLMRequest) {
  const generationConfig: Record<string, unknown> = {};
  if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
  if (req.maxTokens !== undefined) generationConfig.maxOutputTokens = req.maxTokens;
  if (req.json) generationConfig.responseMimeType = "application/json";
  return {
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig,
  };
}

export function geminiLLM(opts: GeminiOptions): LLM {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(opts.model)}:generateContent`;
  const attempt = async (req: LLMRequest): Promise<LLMResponse> => {
    const { status, json, headers } = await postJson(
      fetchImpl,
      url,
      { headers: { "x-goog-api-key": opts.apiKey }, body: geminiRequestBody(req) },
      { provider: "gemini", timeoutMs: req.timeoutMs ?? opts.timeoutMs ?? 60_000, signal: req.signal, secret: opts.apiKey },
    );
    if (status < 200 || status >= 300) throw classifyGeminiError(status, json, headers.get("retry-after"), opts.apiKey);
    return parseGeminiResponse(json, opts.model);
  };
  return {
    provider: "gemini",
    model: opts.model,
    complete: (req) => withRetries(() => attempt(req), { policy: opts.retry ?? DEFAULT_RETRY, wait: opts.sleep ?? sleep, signal: req.signal }),
  };
}

export function parseGeminiResponse(json: unknown, model: string): LLMResponse {
  if (!isObject(json)) throw new LLMError("bad-response", "The answer was not JSON.", { provider: "gemini" });
  const usageMeta = isObject(json.usageMetadata) ? json.usageMetadata : {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const usage = {
    inputTokens: n(usageMeta.promptTokenCount),
    // Thinking tokens are billed as output.
    outputTokens: n(usageMeta.candidatesTokenCount) + n(usageMeta.thoughtsTokenCount),
  };
  const answeredBy = typeof json.modelVersion === "string" && json.modelVersion ? json.modelVersion : model;
  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
  const first = candidates[0];
  if (!isObject(first)) {
    const feedback = isObject(json.promptFeedback) ? json.promptFeedback : null;
    if (feedback && typeof feedback.blockReason === "string") {
      // The prompt itself was blocked: an answer with no text, not a broken response.
      return { text: "", usage, model: answeredBy, finishReason: `BLOCKED:${feedback.blockReason}` };
    }
    throw new LLMError("bad-response", "The answer had no candidates.", { provider: "gemini" });
  }
  const content = isObject(first.content) ? first.content : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  // Thought summaries (thought: true) are not the answer.
  const text = parts
    .filter((p): p is Record<string, unknown> => isObject(p) && p.thought !== true && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
  const finishReason = typeof first.finishReason === "string" ? first.finishReason : null;
  return { text, usage, model: answeredBy, finishReason };
}

/**
 * Gemini errors: { error: { code, message, status, details: [...] } }.
 * A 429 is a daily quota when a QuotaFailure names a per-day quota or the
 * limit is 0 (no free tier for this model); otherwise it is a rate limit, and
 * RetryInfo.retryDelay says how long to wait.
 */
export function classifyGeminiError(status: number, json: unknown, retryAfter: string | null, apiKey: string): LLMError {
  const err = isObject(json) && isObject(json.error) ? json.error : {};
  const raw = typeof err.message === "string" ? err.message : isObject(json) && typeof json.__raw === "string" ? json.__raw : "";
  const message = safeMessage(raw, apiKey);
  const statusName = typeof err.status === "string" ? err.status : "";
  const details = Array.isArray(err.details) ? err.details.filter(isObject) : [];
  const typeOf = (d: Record<string, unknown>) => (typeof d["@type"] === "string" ? (d["@type"] as string) : "");
  const reasons = details.map((d) => (typeof d.reason === "string" ? d.reason : ""));
  const quotaIds = details
    .filter((d) => typeOf(d).endsWith("QuotaFailure"))
    .flatMap((d) => (Array.isArray(d.violations) ? d.violations.filter(isObject) : []))
    .map((v) => `${typeof v.quotaId === "string" ? v.quotaId : ""} ${typeof v.quotaMetric === "string" ? v.quotaMetric : ""}`);
  const retryInfo = details.find((d) => typeOf(d).endsWith("RetryInfo"));
  const wait = durationMs(retryInfo?.retryDelay) ?? retryAfterHeader(retryAfter);
  const base = { provider: "gemini" as const, status };
  const say = (what: string) => `Gemini ${status}${statusName ? ` ${statusName}` : ""}: ${message || what}`;

  if (status === 401 || status === 403 || reasons.includes("API_KEY_INVALID") || /api key (not valid|invalid|expired)/i.test(raw)) {
    return new LLMError("auth", say("the key was rejected"), base);
  }
  if (status === 404) return new LLMError("model-not-found", say("model not found"), base);
  if (status === 429) {
    const daily = quotaIds.some((q) => /per\s*day|perday/i.test(q)) || /limit:\s*0\b/.test(raw);
    if (daily) return new LLMError("quota", say("quota exhausted"), base);
    return new LLMError("rate-limit", say("rate limited"), { ...base, retryAfterMs: wait });
  }
  if (status >= 500) return new LLMError("server", say("server error"), { ...base, retryAfterMs: wait });
  return new LLMError("bad-request", say("request refused"), base);
}
