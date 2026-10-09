/**
 * Seeded simulation of experiment runs (mock provider only).
 *
 * The seed is a hash of the run id, which is built from the investigation,
 * the experiment and the run's role and index: the same experiment always
 * gives the same counts, and every statistic shown is derived from them.
 */
import { mulberry32 } from "@/lib/stats";
import { hashString } from "../derive";
import type { Counts, Experiment, GridCell, Run, Sample, SweepPoint, Trace } from "../types";

type Rand = () => number;

function binomial(rand: Rand, n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rand() < p) k++;
  return k;
}

/** Correlated paired outcomes: each item has a latent difficulty shared across conditions. */
function pairedOutcomes(rand: Rand, n: number, rates: number[], rho = 0.6): number[][] {
  const out = rates.map(() => new Array<number>(n));
  for (let i = 0; i < n; i++) {
    const u = rand();
    rates.forEach((p, j) => {
      const v = rand() < rho ? u : rand();
      out[j][i] = v < p ? 1 : 0;
    });
  }
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface SimulatedResult {
  counts: { control: Counts; treatment: Counts };
  discordant: { b: number; c: number } | null;
  sweep: SweepPoint[] | null;
  grid: GridCell[] | null;
  samples: Sample[];
  traces: Trace[];
}

export function simulateRun(exp: Experiment, run: Pick<Run, "id" | "role">): SimulatedResult {
  const rand = mulberry32(hashString(run.id));
  const d = exp.design;
  const prior = exp.simulation ?? { control: 0.3, treatment: 0.3, sweep: null, grid: null, items: [] };
  const n = d.nPerArm;
  const replication = run.role === "replication";

  let counts: SimulatedResult["counts"];
  let discordant: SimulatedResult["discordant"] = null;
  let sweep: SweepPoint[] | null = null;
  let grid: GridCell[] | null = null;

  if (!replication && d.grid && prior.grid) {
    const g = d.grid;
    grid = [];
    g.rowLevels.forEach((row, ri) =>
      g.colLevels.forEach((col, ci) => {
        const p = prior.grid![ri * g.colLevels.length + ci];
        grid!.push({ row, col, k: binomial(rand, g.nPerCell, p), n: g.nPerCell });
      }),
    );
    const pool = (rows: string[]): Counts =>
      grid!.filter((c) => rows.includes(c.row)).reduce((acc, c) => ({ k: acc.k + c.k, n: acc.n + c.n }), { k: 0, n: 0 });
    counts = { control: pool(g.controlRows), treatment: pool(g.treatmentRows) };
  } else if (!replication && d.sweep && prior.sweep && d.sweep.armsAreEndpoints) {
    const rates = prior.sweep;
    if (d.pairing === "paired") {
      const outcomes = pairedOutcomes(rand, n, rates);
      sweep = d.sweep.levels.map((x, i) => ({ x, k: sum(outcomes[i]), n }));
      const first = outcomes[0];
      const last = outcomes[outcomes.length - 1];
      let b = 0;
      let c = 0;
      for (let i = 0; i < n; i++) {
        if (first[i] === 1 && last[i] === 0) b++;
        if (first[i] === 0 && last[i] === 1) c++;
      }
      discordant = { b, c };
    } else {
      sweep = d.sweep.levels.map((x, i) => ({ x, k: binomial(rand, n, rates[i]), n }));
    }
    counts = {
      control: { k: sweep[0].k, n },
      treatment: { k: sweep[sweep.length - 1].k, n },
    };
  } else if (d.pairing === "paired") {
    const [c0, t0] = pairedOutcomes(rand, n, [prior.control, prior.treatment]);
    let b = 0;
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (c0[i] === 1 && t0[i] === 0) b++;
      if (c0[i] === 0 && t0[i] === 1) c++;
    }
    counts = { control: { k: sum(c0), n }, treatment: { k: sum(t0), n } };
    discordant = { b, c };
  } else {
    counts = {
      control: { k: binomial(rand, n, prior.control), n },
      treatment: { k: binomial(rand, n, prior.treatment), n },
    };
    if (!replication && d.sweep && prior.sweep) {
      sweep = d.sweep.levels.map((x, i) => ({ x, k: binomial(rand, n, prior.sweep![i]), n }));
    }
  }

  const samples: Sample[] = [];
  const traces: Trace[] = [];
  prior.items.forEach((item, i) => {
    const itemId = `${run.id}/item-${i + 1}`;
    (["control", "treatment"] as const).forEach((arm) => {
      const id = `${run.id}/${arm}-${i + 1}`;
      let traceId: string | null = null;
      if (item.steps) {
        traceId = `${id}/trace`;
        traces.push({
          id: traceId,
          steps: [
            { kind: "user", name: null, content: item.prompt, durationMs: null, tokens: null },
            ...item.steps[arm],
            { kind: "model", name: null, content: arm === "control" ? item.control : item.treatment, durationMs: null, tokens: null },
          ],
        });
      }
      samples.push({
        id,
        runId: run.id,
        experimentId: exp.id,
        arm,
        itemId,
        prompt: item.prompt,
        response: arm === "control" ? item.control : item.treatment,
        score: arm === "control" ? item.controlScore : item.treatmentScore,
        rationale: item.rationale,
        flagged: false,
        traceId,
        simulated: true,
      });
    });
  });

  return { counts, discordant, sweep, grid, samples, traces };
}
