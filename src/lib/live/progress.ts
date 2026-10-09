/**
 * What the page shows while a live run streams in: a reducer over the
 * server's events. Pure, so it is unit-tested without a browser.
 */
import type { LLMErrorKind } from "./llm/types";
import { STAGES, type LiveErrorCode, type LiveEvent, type LiveResult, type LiveStage, type Models, type Plan, type RunProgress, type Usage } from "./types";

export type StageState = "pending" | "active" | "done" | "failed";

export interface Attempt {
  attempt: number;
  ok: boolean;
  problems: string[];
}

export interface ViewError {
  code: LiveErrorCode | "http" | "stream";
  kind: LLMErrorKind | null;
  stage: LiveStage | null;
  message: string;
}

export interface LiveView {
  status: "idle" | "starting" | "running" | "done" | "failed" | "cancelled";
  stages: Record<LiveStage, StageState>;
  models: Models | null;
  /** When this browser started the run (epoch ms), for the elapsed-time display. */
  startedAt: number | null;
  draftAttempts: Attempt[];
  plan: Plan | null;
  plannedCalls: number | null;
  progress: RunProgress | null;
  usage: Usage | null;
  interpretAttempts: Attempt[];
  result: LiveResult | null;
  error: ViewError | null;
}

export type LiveAction =
  | LiveEvent
  | { type: "request"; at: number }
  | { type: "http-error"; status: number; message: string }
  | { type: "stream-ended" }
  | { type: "cancelled" };

const pendingStages = (): Record<LiveStage, StageState> => ({ draft: "pending", run: "pending", analyze: "pending", interpret: "pending" });

export const INITIAL_VIEW: LiveView = {
  status: "idle",
  stages: pendingStages(),
  models: null,
  startedAt: null,
  draftAttempts: [],
  plan: null,
  plannedCalls: null,
  progress: null,
  usage: null,
  interpretAttempts: [],
  result: null,
  error: null,
};

const finished = (s: LiveView["status"]) => s === "done" || s === "failed" || s === "cancelled";

export function liveReducer(state: LiveView, action: LiveAction): LiveView {
  switch (action.type) {
    case "request":
      return { ...INITIAL_VIEW, stages: pendingStages(), status: "starting", startedAt: action.at };
    case "start":
      return { ...state, status: "running", models: action.models };
    case "stage": {
      const stages = { ...state.stages, [action.stage]: action.state === "started" ? "active" : "done" };
      return { ...state, status: "running", stages };
    }
    case "draft-attempt":
      return { ...state, draftAttempts: [...state.draftAttempts, { attempt: action.attempt, ok: action.ok, problems: action.problems }] };
    case "plan":
      return { ...state, plan: action.plan, plannedCalls: action.plannedCalls };
    case "progress":
      return { ...state, progress: action.progress, usage: action.usage };
    case "interpret-attempt":
      return { ...state, interpretAttempts: [...state.interpretAttempts, { attempt: action.attempt, ok: action.ok, problems: action.problems }] };
    case "result": {
      const stages = Object.fromEntries(STAGES.map((s) => [s, "done"])) as Record<LiveStage, StageState>;
      return { ...state, status: "done", stages, result: action.result, usage: action.result.usage };
    }
    case "error": {
      const stages = { ...state.stages };
      const at = action.stage ?? STAGES.find((s) => stages[s] === "active") ?? null;
      if (at) stages[at] = "failed";
      return {
        ...state,
        status: action.code === "aborted" ? "cancelled" : "failed",
        stages,
        error: { code: action.code, kind: action.kind, stage: action.stage, message: action.message },
      };
    }
    case "http-error":
      return { ...state, status: "failed", error: { code: "http", kind: null, stage: null, message: action.message } };
    case "cancelled": {
      if (finished(state.status)) return state;
      const stages = { ...state.stages };
      for (const s of STAGES) if (stages[s] === "active") stages[s] = "failed";
      return { ...state, status: "cancelled", stages, error: { code: "aborted", kind: "aborted", stage: null, message: "You cancelled the run." } };
    }
    case "stream-ended":
      if (finished(state.status)) return state;
      return {
        ...state,
        status: "failed",
        error: { code: "stream", kind: null, stage: null, message: "The connection closed before the run finished. Nothing was published." },
      };
  }
}

/** Reads an NDJSON stream into events, line by line. Malformed lines are skipped. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (e: LiveEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = (line: string) => {
    const t = line.trim();
    if (!t) return;
    try {
      onEvent(JSON.parse(t) as LiveEvent);
    } catch {
      // A partial or foreign line: ignore it.
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let i = buffer.indexOf("\n");
    while (i >= 0) {
      flush(buffer.slice(0, i));
      buffer = buffer.slice(i + 1);
      i = buffer.indexOf("\n");
    }
  }
  flush(buffer + decoder.decode());
}
