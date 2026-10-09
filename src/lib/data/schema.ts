/**
 * Validation for anything read back from storage. Storage is untrusted input:
 * a bad or old shape is reset with a visible message, never trusted.
 */
import { z } from "zod";
import type { Investigation } from "./types";

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");
const counts = z.object({ k: z.number().int().nonnegative(), n: z.number().int().nonnegative() });
const stepKind = z.enum(["user", "model", "tool_call", "tool_result", "error"]);
const traceStep = z.object({
  kind: stepKind,
  name: z.string().nullable(),
  content: z.string(),
  durationMs: z.number().nullable(),
  tokens: z.number().nullable(),
});

const arm = z.object({ label: z.string(), systemId: z.string(), config: z.record(z.string(), z.string()) });

const design = z.object({
  datasetId: z.string().nullable(),
  control: arm,
  treatment: arm,
  metric: z.object({
    name: z.string(),
    definition: z.string(),
    positiveLabel: z.string(),
    negativeLabel: z.string(),
    higherIs: z.enum(["better", "worse", "neutral"]),
  }),
  scorer: z.object({
    kind: z.enum(["rule", "judge", "human"]),
    name: z.string(),
    family: z.string().nullable(),
    humanAgreement: z.number().min(0).max(1).nullable(),
    humanAgreementN: z.number().int().nullable(),
  }),
  nPerArm: z.number().int().positive(),
  seed: z.number().int().nullable(),
  randomized: z.boolean().nullable(),
  pairing: z.enum(["paired", "independent"]),
  temperature: z.number().nullable(),
  primary: z.boolean(),
  sweep: z
    .object({
      variable: z.string(),
      unit: z.string(),
      levels: z.array(z.number()),
      seriesLabel: z.string(),
      armsAreEndpoints: z.boolean(),
    })
    .nullable(),
  grid: z
    .object({
      rowVariable: z.string(),
      rowLevels: z.array(z.string()),
      colVariable: z.string(),
      colLevels: z.array(z.string()),
      nPerCell: z.number().int().positive(),
      controlRows: z.array(z.string()),
      treatmentRows: z.array(z.string()),
    })
    .nullable(),
});

const sample = z.object({
  id: z.string(),
  runId: z.string(),
  experimentId: z.string(),
  arm: z.enum(["control", "treatment"]),
  itemId: z.string(),
  prompt: z.string(),
  response: z.string(),
  score: z.union([z.literal(0), z.literal(1)]),
  rationale: z.string().nullable(),
  flagged: z.boolean(),
  traceId: z.string().nullable(),
  simulated: z.boolean(),
});

const run = z
  .object({
    id: z.string(),
    experimentId: z.string(),
    role: z.enum(["primary", "replication", "superseded"]),
    startedAt: iso,
    finishedAt: iso.nullable(),
    expectedDurationMs: z.number().positive(),
    counts: z.object({ control: counts, treatment: counts }).nullable(),
    discordant: z.object({ b: z.number().int().nonnegative(), c: z.number().int().nonnegative() }).nullable(),
    sweep: z.array(z.object({ x: z.number(), k: z.number().int(), n: z.number().int() })).nullable(),
    grid: z.array(z.object({ row: z.string(), col: z.string(), k: z.number().int(), n: z.number().int() })).nullable(),
    modelVersion: z.string().nullable(),
    params: z.record(z.string(), z.string()).nullable(),
    datasetHash: z.string().nullable(),
    configHash: z.string().nullable(),
    tokens: z.number().nullable(),
    costUsd: z.number().nullable(),
    samples: z.array(sample),
    traces: z.array(z.object({ id: z.string(), steps: z.array(traceStep) })),
  })
  .refine((r) => !r.counts || (r.counts.control.k <= r.counts.control.n && r.counts.treatment.k <= r.counts.treatment.n), {
    message: "k exceeds n",
  });

const simulatedItem = z.object({
  prompt: z.string(),
  control: z.string(),
  treatment: z.string(),
  controlScore: z.union([z.literal(0), z.literal(1)]),
  treatmentScore: z.union([z.literal(0), z.literal(1)]),
  rationale: z.string().nullable(),
  steps: z.object({ control: z.array(traceStep), treatment: z.array(traceStep) }).nullable(),
});

const experiment = z.object({
  id: z.string().regex(/^E\d+$/),
  title: z.string(),
  hypothesisId: z.string(),
  status: z.enum(["proposed", "running", "complete", "failed"]),
  design,
  runs: z.array(run),
  createdAt: iso,
  updatedAt: iso,
  simulation: z
    .object({
      control: z.number().min(0).max(1),
      treatment: z.number().min(0).max(1),
      sweep: z.array(z.number().min(0).max(1)).nullable(),
      grid: z.array(z.number().min(0).max(1)).nullable(),
      items: z.array(simulatedItem),
    })
    .nullable(),
});

export const investigationSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  title: z.string().max(200),
  question: z.string().max(4000),
  systemId: z.string(),
  createdAt: iso,
  updatedAt: iso,
  hypotheses: z.array(
    z.object({
      id: z.string().regex(/^H\d+$/),
      text: z.string(),
      prediction: z.enum(["increase", "decrease", "no-difference"]),
      competing: z.boolean(),
    }),
  ),
  experiments: z.array(experiment),
  events: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["question", "hypotheses", "design", "run-started", "run-finished", "analysis", "conclusion", "note", "ask", "answer"]),
      at: iso,
      text: z.string(),
      refs: z.array(z.string()),
      experimentId: z.string().nullable(),
    }),
  ),
  notes: z.string(),
  pinned: z.boolean(),
  templateDraft: z.boolean(),
  failed: z.boolean(),
});

export const STATE_VERSION = 2;

export const persistedSchema = z.object({
  version: z.literal(STATE_VERSION),
  seededAt: iso,
  investigations: z.array(investigationSchema),
});

export type Persisted = { version: typeof STATE_VERSION; seededAt: string; investigations: Investigation[] };

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; data: Persisted }
  | { kind: "reset"; reason: "corrupt" | "old-version" | "invalid" };

/** Parse and validate saved state. Pure, so it is unit-tested without a browser. */
export function parseSaved(raw: string | null): LoadResult {
  if (raw === null || raw === "") return { kind: "empty" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { kind: "reset", reason: "corrupt" };
  }
  if (!json || typeof json !== "object") return { kind: "reset", reason: "corrupt" };
  const version = (json as { version?: unknown }).version;
  if (version !== STATE_VERSION) return { kind: "reset", reason: "old-version" };
  const parsed = persistedSchema.safeParse(json);
  if (!parsed.success) return { kind: "reset", reason: "invalid" };
  return { kind: "ok", data: parsed.data as Persisted };
}

export const RESET_MESSAGE: Record<"corrupt" | "old-version" | "invalid", string> = {
  corrupt: "Saved data could not be read, so the demo workspace was reset.",
  "old-version": "Saved data came from an older version, so the demo workspace was reset.",
  invalid: "Saved data did not match the expected shape, so the demo workspace was reset.",
};
