/**
 * Runs the planted-cause benchmark over the scenario grid and tallies how
 * each method's attribution compares with the planted truth. Deterministic:
 * the same config gives the same numbers on every run.
 */
import { analyzeRun } from "@/lib/data/derive";
import { THRESHOLDS } from "@/lib/validity";
import { experimentRunId, toRun } from "./bridge";
import { EXAMPLE_SPECS, findExample, type Example } from "./examples";
import { METHOD_IDS, METHODS, overall, score, type MethodId, type Outcome } from "./methods";
import { GRID, scenarioFor, trueDeltas, type Cell } from "./scenario";

export interface BenchConfig {
  /** Replicates per grid cell for the attribution metrics. */
  reps: number;
  /** Replicates per cell (the first ones) whose per-experiment 95% CIs are checked for coverage. */
  coverageReps: number;
}

/** The configuration docs/BENCHMARK.md is generated with. */
export const BENCH_CONFIG: BenchConfig = { reps: 1000, coverageReps: 50 };

export interface Tally {
  scenarios: number;
  correct: number;
  wrong: number;
  missed: number;
  quiet: number;
  falseAlarm: number;
  /** No-cause scenarios where v2 happened to score below v1 overall (a drop a team would investigate). */
  dropSeen: number;
  /** False alarms among those. */
  falseAlarmAfterDrop: number;
}

export interface Coverage {
  /** Experiments whose factor is the true cause. */
  cause: { intervals: number; covered: number; widthSum: number };
  /** Experiments whose factor changed nothing (true Δ = 0). */
  inert: { intervals: number; covered: number; widthSum: number };
  /**
   * Experiments where the app's CI-based call (effect found: the CI excludes 0)
   * agrees with the raw exact McNemar test at the rubric's alpha.
   */
  callsAgree: number;
}

export interface CellResult {
  cell: Cell;
  methods: Record<MethodId, Tally>;
  /** Baseline A: the overall v1 → v2 drop was significant. */
  overallDetected: number;
  coverage: Coverage;
}

/** Sensitivity run: one cell, the latent item correlation fixed at each level. */
export const SENSITIVITY = { cell: { K: 3, effectPP: 10, n: 80 }, rho: [0, 0.5, 0.8, 0.95] } as const;

export interface BenchResult {
  config: BenchConfig;
  cells: CellResult[];
  sensitivity: CellResult[];
  /** One per entry of EXAMPLE_SPECS, null when no replicate matched. */
  examples: (Example | null)[];
}

export const emptyTally = (): Tally => ({
  scenarios: 0,
  correct: 0,
  wrong: 0,
  missed: 0,
  quiet: 0,
  falseAlarm: 0,
  dropSeen: 0,
  falseAlarmAfterDrop: 0,
});

const emptyCoverage = (): Coverage => ({
  cause: { intervals: 0, covered: 0, widthSum: 0 },
  inert: { intervals: 0, covered: 0, widthSum: 0 },
  callsAgree: 0,
});

const OUTCOME_FIELD: Record<Outcome, keyof Tally> = {
  correct: "correct",
  wrong: "wrong",
  missed: "missed",
  quiet: "quiet",
  "false-alarm": "falseAlarm",
};

export function cells(): Cell[] {
  const out: Cell[] = [];
  for (const K of GRID.K) for (const effectPP of GRID.effectPP) for (const n of GRID.n) out.push({ K, effectPP, n });
  return out;
}

/** Benchmark one cell: every method on `reps` replicates, CI coverage on the first `coverageReps`. */
export function runCell(cell: Cell, { reps, coverageReps }: BenchConfig): CellResult {
  const methods = Object.fromEntries(METHOD_IDS.map((m) => [m, emptyTally()])) as Record<MethodId, Tally>;
  const coverage = emptyCoverage();
  let overallDetected = 0;
  for (let rep = 0; rep < reps; rep++) {
    const data = scenarioFor(cell, rep);
    const cause = data.scenario.cause;
    const dropSeen = cause === null && data.overall.kTreatment < data.overall.kControl;
    for (const m of METHOD_IDS) {
      const blamed = METHODS[m](data).blamed;
      const t = methods[m];
      const outcome = score(blamed, cause);
      t.scenarios++;
      t[OUTCOME_FIELD[outcome]]++;
      if (dropSeen) {
        t.dropSeen++;
        if (outcome === "false-alarm") t.falseAlarmAfterDrop++;
      }
    }
    if (overall(data).detected) overallDetected++;
    if (rep < coverageReps) {
      const truth = trueDeltas(data.scenario);
      data.experiments.forEach((e, j) => {
        // Diablo's own analysis of a paired run: the seeded paired bootstrap (2,000 resamples).
        const r = analyzeRun(toRun(experimentRunId(data, rep, j), e), "paired")!;
        const [lo, hi] = r.diffCI;
        if (r.p < THRESHOLDS.alpha === r.effectFound) coverage.callsAgree++;
        const bucket = j === cause ? coverage.cause : coverage.inert;
        bucket.intervals++;
        if (lo <= truth[j] && truth[j] <= hi) bucket.covered++;
        bucket.widthSum += hi - lo;
      });
    }
  }
  return { cell, methods, overallDetected, coverage };
}

export function runBenchmark(config: BenchConfig = BENCH_CONFIG): BenchResult {
  return {
    config,
    cells: cells().map((cell) => runCell(cell, config)),
    sensitivity: SENSITIVITY.rho.map((rho) => runCell({ ...SENSITIVITY.cell, rho }, { ...config, coverageReps: 0 })),
    examples: EXAMPLE_SPECS.map((spec) => findExample(spec, config.reps)),
  };
}

/* ── Pooling ───────────────────────────────────────────────────── */

export type CellFilter = (c: Cell) => boolean;

export function pool(result: BenchResult, method: MethodId, keep: CellFilter): Tally {
  const out = emptyTally();
  for (const r of result.cells) {
    if (!keep(r.cell)) continue;
    const t = r.methods[method];
    for (const k of Object.keys(out) as (keyof Tally)[]) out[k] += t[k];
  }
  return out;
}

export function poolDetected(result: BenchResult, keep: CellFilter): { detected: number; scenarios: number } {
  let detected = 0;
  let scenarios = 0;
  for (const r of result.cells) {
    if (!keep(r.cell)) continue;
    detected += r.overallDetected;
    scenarios += r.methods.overall.scenarios;
  }
  return { detected, scenarios };
}

export function poolCoverage(result: BenchResult, keep: CellFilter): Coverage {
  const out = emptyCoverage();
  for (const r of result.cells) {
    if (!keep(r.cell)) continue;
    for (const k of ["cause", "inert"] as const) {
      out[k].intervals += r.coverage[k].intervals;
      out[k].covered += r.coverage[k].covered;
      out[k].widthSum += r.coverage[k].widthSum;
    }
    out.callsAgree += r.coverage.callsAgree;
  }
  return out;
}

export const withCause: CellFilter = (c) => c.effectPP > 0;
export const noCause: CellFilter = (c) => c.effectPP === 0;
export const and =
  (...fs: CellFilter[]): CellFilter =>
  (c) =>
    fs.every((f) => f(c));
