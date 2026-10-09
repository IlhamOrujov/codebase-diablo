/**
 * The data model. Everything the validity checks need but that was not
 * recorded is `null`, and the UI shows it as "Not recorded". Statistics are
 * never stored: they are derived from counts by src/lib/stats.ts.
 */

export type ISODate = string;

/* ── AI systems and datasets ───────────────────────────────────── */

export type SystemKind = "model" | "agent" | "app";

export interface AISystem {
  id: string;
  /** Display name, e.g. "Model X v4". */
  name: string;
  /** Product line, e.g. "Model X"; versions of one product share it. */
  product: string;
  version: string;
  kind: SystemKind;
  /** Model family. Used by check C4 (is the scorer independent of the target?). */
  family: string | null;
  /** Exact model or build string, when known. */
  versionString: string | null;
  description: string;
}

export interface DatasetField {
  name: string;
  type: string;
  description: string;
}

export interface Dataset {
  id: string;
  name: string;
  /** Number of items. */
  size: number;
  split: "test" | "validation" | "train" | "custom";
  /** Held out from any tuning of the target. Null when unknown. */
  heldOut: boolean | null;
  /** Content hash of the item file, when recorded. */
  hash: string | null;
  description: string;
  schema: DatasetField[];
  sampleRows: Record<string, string>[];
}

/* ── Investigations ────────────────────────────────────────────── */

export type InvestigationStatus = "draft" | "running" | "needs-review" | "complete" | "replicated" | "failed";
export type ExperimentStatus = "proposed" | "running" | "complete" | "failed";

/** The direction a hypothesis predicts for treatment − control on its experiments. */
export type Prediction = "increase" | "decrease" | "no-difference";

export interface Hypothesis {
  id: string; // "H1"
  text: string;
  prediction: Prediction;
  /** A competing explanation for the main effect (feeds check C9). */
  competing: boolean;
}

export interface ArmConfig {
  /** Short label, e.g. "Model X v3" or "Hedged claim". */
  label: string;
  systemId: string;
  /** Config the arm runs with, shown as a diff between arms. */
  config: Record<string, string>;
}

export interface Metric {
  name: string;
  definition: string;
  /** Wording for a positive and a negative outcome, e.g. "Behaviour present". */
  positiveLabel: string;
  negativeLabel: string;
  /** Whether a higher rate is better for the system, worse, or neither. */
  higherIs: "better" | "worse" | "neutral";
}

export interface Scorer {
  kind: "rule" | "judge" | "human";
  name: string;
  /** Model family of a judge (C4). Null when unknown or not a model. */
  family: string | null;
  /** Agreement with human labels, 0..1 (C5). Null when never checked. */
  humanAgreement: number | null;
  /** Number of items the agreement was measured on. */
  humanAgreementN: number | null;
}

export interface SweepDesign {
  variable: string;
  /** Singular unit, e.g. "tool" or "turn". */
  unit: string;
  levels: number[];
  /** Label of the series this experiment contributes to a curve. */
  seriesLabel: string;
  /**
   * true: the arms are the first and last levels of the sweep (control = first).
   * false: the arms are run separately and the sweep adds extra points for the treatment series.
   */
  armsAreEndpoints: boolean;
}

export interface GridDesign {
  rowVariable: string;
  rowLevels: string[];
  colVariable: string;
  colLevels: string[];
  /** Items per cell. */
  nPerCell: number;
  /** Rows pooled into each arm; the arm counts are sums over these rows. */
  controlRows: string[];
  treatmentRows: string[];
}

export interface ExperimentDesign {
  datasetId: string | null;
  control: ArmConfig;
  treatment: ArmConfig;
  metric: Metric;
  scorer: Scorer;
  /** Planned items per arm. */
  nPerArm: number;
  seed: number | null;
  /** Items assigned to arms at random. Null when not recorded. */
  randomized: boolean | null;
  pairing: "paired" | "independent";
  temperature: number | null;
  /** A primary test counts towards the multiple-comparison correction (C7). */
  primary: boolean;
  sweep: SweepDesign | null;
  grid: GridDesign | null;
}

export interface Counts {
  k: number;
  n: number;
}

export interface SweepPoint {
  x: number;
  k: number;
  n: number;
}

export interface GridCell {
  row: string;
  col: string;
  k: number;
  n: number;
}

export type TraceStepKind = "user" | "model" | "tool_call" | "tool_result" | "error";

export interface TraceStep {
  kind: TraceStepKind;
  /** Tool name for tool steps. */
  name: string | null;
  content: string;
  durationMs: number | null;
  tokens: number | null;
}

export interface Trace {
  id: string;
  steps: TraceStep[];
}

export interface Sample {
  /** Unique across the workspace. */
  id: string;
  runId: string;
  experimentId: string;
  arm: "control" | "treatment";
  /** Pairs a control and a treatment sample on the same item. */
  itemId: string;
  prompt: string;
  response: string;
  /** 1 when the metric's positive outcome was scored. */
  score: 0 | 1;
  rationale: string | null;
  flagged: boolean;
  traceId: string | null;
  /** Produced by the mock provider, not by a real run. */
  simulated: boolean;
}

export interface Run {
  id: string;
  experimentId: string;
  /** "primary" is the current main run; a re-run supersedes it; "replication" repeats it with a new seed. */
  role: "primary" | "replication" | "superseded";
  startedAt: ISODate;
  finishedAt: ISODate | null;
  /** Planned duration, used to derive progress while running. */
  expectedDurationMs: number;
  counts: { control: Counts; treatment: Counts } | null;
  /** Paired designs only: control-only positives (b) and treatment-only positives (c). */
  discordant: { b: number; c: number } | null;
  /** One series over the design's sweep levels (see ExperimentDesign.sweep). */
  sweep: SweepPoint[] | null;
  grid: GridCell[] | null;
  modelVersion: string | null;
  params: Record<string, string> | null;
  datasetHash: string | null;
  configHash: string | null;
  tokens: number | null;
  costUsd: number | null;
  samples: Sample[];
  traces: Trace[];
}

/**
 * Mock provider only: the rates the simulator draws from. Real data never has
 * this (null). The UI never shows it; it only shows counts from finished runs.
 */
export interface SimulationPrior {
  control: number;
  treatment: number;
  /** Rate per sweep level for the swept series. */
  sweep: number[] | null;
  /** Rate per grid cell, row-major. */
  grid: number[] | null;
  /** Example items the simulator turns into (clearly labelled) simulated samples. */
  items: SimulatedItem[];
}

export interface SimulatedItem {
  prompt: string;
  control: string;
  treatment: string;
  controlScore: 0 | 1;
  treatmentScore: 0 | 1;
  rationale: string | null;
  /** Optional agent steps between the prompt and the response, per arm (tool use). */
  steps: { control: TraceStep[]; treatment: TraceStep[] } | null;
}

export interface Experiment {
  id: string; // "E1"
  title: string;
  hypothesisId: string;
  status: ExperimentStatus;
  design: ExperimentDesign;
  runs: Run[];
  createdAt: ISODate;
  updatedAt: ISODate;
  simulation: SimulationPrior | null;
}

export type EventKind =
  | "question"
  | "hypotheses"
  | "design"
  | "run-started"
  | "run-finished"
  | "analysis"
  | "conclusion"
  | "note"
  | "ask"
  | "answer";

export interface SessionEvent {
  id: string;
  kind: EventKind;
  at: ISODate;
  text: string;
  /** Objects the event mentions (E1, H2…), which open the detail panel. */
  refs: string[];
  experimentId: string | null;
}

export interface Investigation {
  id: string;
  title: string;
  question: string;
  systemId: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  hypotheses: Hypothesis[];
  experiments: Experiment[];
  events: SessionEvent[];
  /** The researcher's own notes, shown in the report's limitations. */
  notes: string;
  pinned: boolean;
  /** Drafted from the generic template (the topic was not recognised). */
  templateDraft: boolean;
  /** Set when the run failed and needs attention. */
  failed: boolean;
}
