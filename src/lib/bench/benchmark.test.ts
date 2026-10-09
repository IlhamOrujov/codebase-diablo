/**
 * Pins the planted-cause benchmark: the committed docs/BENCHMARK.md must be
 * exactly what the benchmark generates, and every number that
 * docs/SUBMISSION.md and docs/SCORECARD.md quote from it is checked here.
 * The full run takes a few seconds (45,000 scenarios plus the bootstrap CIs).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { formatPct } from "@/lib/stats";
import { and, BENCH_CONFIG, noCause, pool, poolCoverage, poolDetected, runBenchmark, runCell, withCause } from "./benchmark";
import type { BenchResult, CellFilter } from "./benchmark";
import { headline, namedRight, renderReport, type Headline } from "./report";
import { GRID, type Cell } from "./scenario";

let result: BenchResult;
let h: Headline;

beforeAll(() => {
  result = runBenchmark(BENCH_CONFIG);
  h = headline(result);
}, 300_000);

const pct = (k: number, n: number) => formatPct(k / n);
const byCell =
  (want: Partial<Cell>): CellFilter =>
  (c) =>
    (want.K === undefined || c.K === want.K) &&
    (want.effectPP === undefined || c.effectPP === want.effectPP) &&
    (want.n === undefined || c.n === want.n);

describe("docs/BENCHMARK.md", () => {
  it("is exactly what `npm run bench` generates (rerun it and commit after any change)", () => {
    const committed = readFileSync(fileURLToPath(new URL("../../../docs/BENCHMARK.md", import.meta.url)), "utf8");
    expect(renderReport(result) === committed).toBe(true);
  });

  it("runs the configuration it reports", () => {
    expect(BENCH_CONFIG).toEqual({ reps: 1000, coverageReps: 50 });
    expect(result.cells).toHaveLength(GRID.K.length * GRID.effectPP.length * GRID.n.length);
    expect(h.scenarios).toBe(45000);
    expect(h.withCause).toBe(36000);
    expect(h.noCause).toBe(9000);
  });

  it("is deterministic: a cell rerun gives identical tallies", () => {
    const cell = { K: 3, effectPP: 10, n: 40 };
    const again = runCell(cell, { reps: BENCH_CONFIG.reps, coverageReps: 5 });
    const first = result.cells.find((r) => r.cell.K === 3 && r.cell.effectPP === 10 && r.cell.n === 40)!;
    expect(again.methods).toEqual(first.methods);
    expect(again.overallDetected).toBe(first.overallDetected);
  });
});

describe("headline numbers quoted in SUBMISSION.md and SCORECARD.md", () => {
  it("Diablo protocol", () => {
    const d = h.method.diablo;
    const nr = namedRight(d.all);
    expect(pct(d.cause.correct, d.cause.scenarios)).toBe("41.0%");
    expect(pct(d.cause.wrong, d.cause.scenarios)).toBe("0.9%");
    expect(pct(d.none.falseAlarm, d.none.scenarios)).toBe("1.1%");
    expect(pct(nr.right, nr.named)).toBe("97.3%");
  });

  it("D. Largest observed drop (the untested judgment)", () => {
    const D = h.method.largest;
    const nr = namedRight(D.all);
    expect(pct(D.cause.correct, D.cause.scenarios)).toBe("84.5%");
    expect(pct(D.cause.wrong, D.cause.scenarios)).toBe("13.1%");
    expect(pct(D.none.falseAlarm, D.none.scenarios)).toBe("81.0%");
    expect(pct(nr.right, nr.named)).toBe("71.7%");
  });

  it("C. Paired tests without correction", () => {
    const C = h.method.uncorrected;
    expect(pct(C.cause.correct, C.cause.scenarios)).toBe("49.7%");
    expect(pct(C.cause.wrong, C.cause.scenarios)).toBe("2.4%");
    expect(pct(C.none.falseAlarm, C.none.scenarios)).toBe("4.1%");
    const nr = namedRight(C.all);
    expect(pct(nr.right, nr.named)).toBe("93.5%");
  });

  it("B. Unpaired tests with Holm", () => {
    const B = h.method.unpaired;
    expect(pct(B.cause.correct, B.cause.scenarios)).toBe("31.7%");
    expect(pct(B.cause.wrong, B.cause.scenarios)).toBe("0.3%");
    expect(pct(B.none.falseAlarm, B.none.scenarios)).toBe("0.4%");
    const nr = namedRight(B.all);
    expect(pct(nr.right, nr.named)).toBe("98.6%");
  });

  it("A. Overall before/after detects the drop but never attributes", () => {
    expect(h.method.overall.all.correct + h.method.overall.all.wrong + h.method.overall.all.falseAlarm).toBe(0);
    expect(pct(h.overallDetected.detected, h.overallDetected.scenarios)).toBe("51.7%");
  });

  it("items needed: Diablo reaches 80% at n = 80 for 20 pp and n = 160 for 15 pp, not for 5 or 10 pp", () => {
    const at = (effectPP: number, n: number) => {
      const t = pool(result, "diablo", byCell({ effectPP, n }));
      return pct(t.correct, t.scenarios);
    };
    expect(at(20, 80)).toBe("83.1%");
    expect(at(15, 80)).toBe("55.4%");
    expect(at(15, 160)).toBe("89.2%");
    expect(at(10, 160)).toBe("56.0%");
    expect(at(5, 160)).toBe("13.6%");
  });

  it("95% CI coverage of the true Δ (Diablo's paired bootstrap)", () => {
    const c = poolCoverage(result, () => true);
    expect(c.cause.intervals).toBe(1800);
    expect(c.inert.intervals).toBe(4950);
    expect(pct(c.cause.covered, c.cause.intervals)).toBe("95.5%");
    expect(pct(c.inert.covered, c.inert.intervals)).toBe("96.1%");
  });
});

describe("claims the report's prose makes", () => {
  const rows = (keep: CellFilter) => result.cells.filter((r) => keep(r.cell));

  it("Diablo's false-alarm rate stays within Holm's bound in every no-cause cell, and C's grows with K", () => {
    for (const r of rows(noCause)) {
      expect(r.methods.diablo.falseAlarm / r.methods.diablo.scenarios).toBeLessThan(0.025);
      expect(r.methods.largest.falseAlarm / r.methods.largest.scenarios).toBeGreaterThan(0.6);
    }
    const cByK = GRID.K.map((K) => {
      const t = pool(result, "uncorrected", and(noCause, byCell({ K })));
      return t.falseAlarm / t.scenarios;
    });
    expect(cByK[0]).toBeLessThan(cByK[1]);
    expect(cByK[1]).toBeLessThan(cByK[2]);
  });

  it("Diablo rarely blames an innocent factor in any cell; D does so most at the smallest drop and n", () => {
    for (const r of rows(withCause)) {
      expect(r.methods.diablo.wrong / r.methods.diablo.scenarios).toBeLessThan(0.025);
    }
    const dWrong = (c: Partial<Cell>) => {
      const t = pool(result, "largest", byCell(c));
      return t.wrong / t.scenarios;
    };
    expect(dWrong({ effectPP: 5, n: 40 })).toBeGreaterThan(dWrong({ effectPP: 20, n: 160 }));
  });

  it("pairing helps on identical counts: Diablo finds more than unpaired tests in every cell with n ≥ 80 and a drop ≥ 10 pp", () => {
    for (const r of rows((c) => c.n >= 80 && c.effectPP >= 10)) {
      expect(r.methods.diablo.correct).toBeGreaterThanOrEqual(r.methods.unpaired.correct);
    }
  });

  it("the overall test flags no-cause scenarios at about its nominal rate", () => {
    const fa = poolDetected(result, noCause);
    expect(fa.detected / fa.scenarios).toBeLessThan(0.025);
  });
});

describe("failure examples", () => {
  it("are found, in the documented cells and replicates", () => {
    const found = result.examples.map((e) => e && { id: e.spec.id, cell: e.cell, rep: e.analysis.rep });
    expect(found).toEqual([
      { id: "wrong-revert", cell: { K: 4, effectPP: 10, n: 80 }, rep: 53 },
      { id: "uncorrected-extra", cell: { K: 4, effectPP: 10, n: 80 }, rep: 17 },
      { id: "no-cause", cell: { K: 4, effectPP: 0, n: 80 }, rep: 3 },
      { id: "unpaired-miss", cell: { K: 3, effectPP: 10, n: 80 }, rep: 4 },
      { id: "diablo-miss", cell: { K: 3, effectPP: 10, n: 40 }, rep: 0 },
      { id: "diablo-wrong", cell: { K: 4, effectPP: 5, n: 160 }, rep: 9 },
      { id: "diablo-false-alarm", cell: { K: 4, effectPP: 0, n: 160 }, rep: 108 },
    ]);
  });

  it("example 1: both baselines revert retrieval top-k; the real cause was the temperature", () => {
    const a = result.examples[0]!.analysis;
    const name = (j: number) => a.data.scenario.factors[j];
    expect(name(a.data.scenario.cause!)).toBe("temperature");
    expect(a.largest.blamed.map(name)).toEqual(["retrieval top-k"]);
    expect(a.uncorrected.blamed.map(name)).toEqual(["retrieval top-k"]);
    expect(a.diablo.blamed).toEqual([]);
  });
});
