/**
 * Shared plumbing for the HTTP adapters: one attempt with a timeout, retries
 * with capped backoff on 429/5xx only, and error text that can never carry the
 * API key.
 */
import { isRetryable, LLMError, type LLMProvider } from "./types";

export type Fetch = typeof globalThis.fetch;
export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface RetryPolicy {
  /** Extra attempts after the first (default 3). */
  retries: number;
  /** First backoff, doubled each time (default 1 s). */
  baseDelayMs: number;
  /** Ceiling for any single wait, including a provider's Retry-After (default 20 s). */
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { retries: 3, baseDelayMs: 1000, maxDelayMs: 20_000 };

export const sleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal!.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Runs `attempt` until it succeeds, fails with a non-retryable error, or the
 * retries run out. Only rate limits (429, not a daily quota) and server errors
 * (5xx) are retried; the wait is the provider's Retry-After when it gave one,
 * else exponential, and never more than maxDelayMs.
 */
export async function withRetries<T>(
  attempt: () => Promise<T>,
  { policy = DEFAULT_RETRY, wait = sleep, signal }: { policy?: RetryPolicy; wait?: Sleep; signal?: AbortSignal } = {},
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (e) {
      if (!isRetryable(e) || i >= policy.retries || signal?.aborted) throw e;
      const backoff = policy.baseDelayMs * 2 ** i;
      const delay = Math.min(policy.maxDelayMs, Math.max(backoff, e.retryAfterMs ?? 0));
      try {
        await wait(delay, signal);
      } catch {
        throw new LLMError("aborted", "The call was cancelled while waiting to retry.", { provider: e.provider });
      }
    }
  }
}

/** Removes every occurrence of the secret from a string. */
export function redact(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("[redacted]");
}

/** A provider message, shortened and with the key removed, safe to show and to log. */
export function safeMessage(text: unknown, secret: string, max = 300): string {
  const s = typeof text === "string" ? text : "";
  const clean = redact(s, secret).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** "41s", "1.5s" (protobuf Duration as JSON) → ms. */
export function durationMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return m ? Math.round(Number(m[1]) * 1000) : null;
}

/** Retry-After header: seconds or an HTTP date. */
export function retryAfterHeader(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value.trim())) return Math.round(Number(value) * 1000);
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : Math.max(0, t - now);
}

/**
 * One HTTP POST with a timeout and the caller's cancel signal. Network
 * failures, timeouts and cancellation become typed LLMErrors; the response is
 * returned as is for the adapter to classify.
 */
export async function postJson(
  fetchImpl: Fetch,
  url: string,
  init: { headers: Record<string, string>; body: unknown },
  opts: { provider: LLMProvider; timeoutMs: number; signal?: AbortSignal; secret: string },
): Promise<{ status: number; json: unknown; headers: Headers }> {
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...init.headers },
      body: JSON.stringify(init.body),
      signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw new LLMError("aborted", "The call was cancelled.", { provider: opts.provider });
    if (timeout.aborted) {
      throw new LLMError("timeout", `No answer within ${Math.round(opts.timeoutMs / 1000)} s.`, { provider: opts.provider });
    }
    const why = e instanceof Error ? safeMessage(e.message, opts.secret, 160) : "unknown error";
    throw new LLMError("network", `Could not reach the provider (${why}).`, { provider: opts.provider });
  }
  let text = "";
  try {
    text = await res.text();
  } catch {
    if (opts.signal?.aborted) throw new LLMError("aborted", "The call was cancelled.", { provider: opts.provider });
    if (timeout.aborted) {
      throw new LLMError("timeout", `No answer within ${Math.round(opts.timeoutMs / 1000)} s.`, { provider: opts.provider });
    }
    throw new LLMError("network", "The connection closed before the answer arrived.", { provider: opts.provider, status: res.status });
  }
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { __raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
