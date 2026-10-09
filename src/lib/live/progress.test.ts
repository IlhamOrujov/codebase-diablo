import { describe, expect, it } from "vitest";
import { DEFAULT_CAPS, maxCalls } from "./budget";
import { INITIAL_VIEW, liveReducer, readEvents, type LiveAction } from "./progress";
import type { LiveEvent } from "./types";

const models = { provider: "fake" as const, reasoning: "r", target: "t" };
const apply = (actions: LiveAction[]) => actions.reduce(liveReducer, INITIAL_VIEW);

describe("live page state", () => {
  it("follows the stages and keeps the latest progress", () => {
    const v = apply([
      { type: "request", at: 1 },
      { type: "start", at: "2026-10-09T10:00:00Z", models, caps: DEFAULT_CAPS, estimate: maxCalls(DEFAULT_CAPS) },
      { type: "stage", stage: "draft", state: "started", at: "x" },
      { type: "draft-attempt", attempt: 1, ok: false, problems: ["bad"] },
      { type: "draft-attempt", attempt: 2, ok: true, problems: [] },
      { type: "stage", stage: "draft", state: "done", at: "x" },
      { type: "stage", stage: "run", state: "started", at: "x" },
      { type: "progress", progress: { done: 3, total: 120, scored: 3, failed: 0, cancelled: 0 }, usage: { calls: 5, inputTokens: 1, outputTokens: 1, byStage: { draft: { calls: 2, inputTokens: 0, outputTokens: 0 }, run: { calls: 3, inputTokens: 0, outputTokens: 0 }, interpret: { calls: 0, inputTokens: 0, outputTokens: 0 } } } },
    ]);
    expect(v.status).toBe("running");
    expect(v.stages).toEqual({ draft: "done", run: "active", analyze: "pending", interpret: "pending" });
    expect(v.draftAttempts.map((a) => a.ok)).toEqual([false, true]);
    expect(v.progress?.done).toBe(3);
    expect(v.usage?.calls).toBe(5);
  });

  it("marks the failing stage and keeps the message", () => {
    const v = apply([
      { type: "request", at: 1 },
      { type: "stage", stage: "draft", state: "started", at: "x" },
      { type: "error", stage: "draft", code: "draft-invalid", kind: null, message: "no valid plan" },
    ]);
    expect(v.status).toBe("failed");
    expect(v.stages.draft).toBe("failed");
    expect(v.error).toMatchObject({ code: "draft-invalid", message: "no valid plan" });
  });

  it("a stream that ends without a result is a failure, never a result", () => {
    const v = apply([{ type: "request", at: 1 }, { type: "stage", stage: "run", state: "started", at: "x" }, { type: "stream-ended" }]);
    expect(v.status).toBe("failed");
    expect(v.result).toBeNull();
    expect(v.error?.code).toBe("stream");
  });

  it("cancel stops a running view but not a finished one", () => {
    const running = apply([{ type: "request", at: 1 }, { type: "stage", stage: "run", state: "started", at: "x" }, { type: "cancelled" }]);
    expect(running.status).toBe("cancelled");
    expect(running.stages.run).toBe("failed");
    const failed = apply([{ type: "request", at: 1 }, { type: "http-error", status: 503, message: "not configured" }, { type: "cancelled" }]);
    expect(failed.status).toBe("failed");
  });

  it("a new request starts from a clean slate", () => {
    const v = apply([{ type: "request", at: 1 }, { type: "http-error", status: 429, message: "wait" }, { type: "request", at: 1 }]);
    expect(v).toMatchObject({ status: "starting", error: null, result: null });
  });
});

describe("NDJSON reader", () => {
  it("reassembles events split across chunks and skips junk", async () => {
    const events: LiveEvent[] = [
      { type: "stage", stage: "draft", state: "started", at: "a" },
      { type: "error", stage: null, code: "internal", kind: null, message: "x" },
    ];
    const text = `${JSON.stringify(events[0])}\nnot json\n${JSON.stringify(events[1])}`;
    const bytes = new TextEncoder().encode(text);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
        c.close();
      },
    });
    const seen: LiveEvent[] = [];
    await readEvents(stream, (e) => seen.push(e));
    expect(seen).toEqual(events);
  });
});
