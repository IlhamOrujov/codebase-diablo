import { describe, expect, it } from "vitest";
import { holm, mcnemarExact, twoProportionZ } from "@/lib/stats";
import { diablo, largest, overall, score, uncorrected, unpaired } from "./methods";
import { FACTOR_NAMES, type PairedCounts, type SimulatedData } from "./scenario";

/** A paired comparison: k correct out of n in each arm, b/c discordant pairs. */
function pc(kControl: number, kTreatment: number, b: number, c: number, n = 80): PairedCounts {
  if (kTreatment - kControl !== c - b) throw new Error("inconsistent counts");
  return { n, kControl, kTreatment, b, c };
}

/** Hand-built data: experiments in order, an overall comparison, and the planted cause. */
function data(experiments: PairedCounts[], cause: number | null, all = pc(70, 60, 12, 2)): SimulatedData {
  const K = experiments.length;
  return {
    scenario: {
      cell: { K, effectPP: cause === null ? 0 : 10, n: experiments[0].n },
      K,
      effectPP: cause === null ? 0 : 10,
      n: experiments[0].n,
      seed: 1,
      base: 0.85,
      rho: 0.6,
      cause,
      factors: FACTOR_NAMES.slice(0, K),
    },
    overall: all,
    experiments,
  };
}

// The worked example in docs/SUBMISSION.md: E1 is the system prompt, E2 the temperature.
const E1 = pc(69, 57, 16, 4); // −15.0 pp, exact McNemar p = 0.012
const E2 = pc(69, 68, 5, 4); // −1.3 pp, p > 0.99
const NULL = pc(60, 60, 6, 6);

describe("Diablo protocol", () => {
  it("uses the exact McNemar test and Holm from stats.ts", () => {
    const r = diablo(data([E1, E2], 0));
    expect(r.p).toEqual([mcnemarExact(16, 4), mcnemarExact(5, 4)]);
    expect(r.adjusted).toEqual(holm(r.p));
  });

  it("names the system prompt in the worked example, and nothing else", () => {
    const r = diablo(data([E1, E2], 0));
    expect(r.adjusted[0]).toBeCloseTo(0.0236, 4);
    expect(r.blamed).toEqual([0]);
  });

  it("drops a raw p below 0.05 once Holm accounts for four experiments", () => {
    const borderline = pc(70, 60, 13, 3); // p ≈ 0.021 alone
    expect(mcnemarExact(13, 3)).toBeLessThan(0.05);
    expect(diablo(data([borderline, NULL], 0)).blamed).toEqual([0]); // 2 tests: 0.042
    expect(diablo(data([borderline, NULL, NULL, NULL], 0)).blamed).toEqual([]); // 4 tests: 0.084
  });

  it("never blames a factor whose accuracy rose, however significant", () => {
    const rise = pc(57, 69, 4, 16);
    const r = diablo(data([rise, NULL], null));
    expect(r.adjusted[0]).toBeLessThan(0.05);
    expect(r.blamed).toEqual([]);
  });

  it("can blame more than one factor when several survive Holm", () => {
    expect(diablo(data([E1, NULL, E1], 0)).blamed).toEqual([0, 2]);
  });
});

describe("baselines", () => {
  it("A (overall) detects a significant overall drop but never attributes", () => {
    const drop = overall(data([E1, E2], 0, pc(70, 55, 18, 3)));
    expect(drop.detected).toBe(true);
    expect(drop.blamed).toEqual([]);
    expect(overall(data([E1, E2], 0, pc(55, 70, 3, 18))).detected).toBe(false); // a rise is not a regression
    expect(overall(data([E1, E2], 0, pc(70, 67, 8, 5))).detected).toBe(false);
  });

  it("B (unpaired) runs the pooled z-test on the same counts, with Holm", () => {
    const r = unpaired(data([E1, E2], 0));
    const p = [twoProportionZ(69, 80, 57, 80).p, twoProportionZ(69, 80, 68, 80).p];
    expect(r.adjusted).toEqual(holm(p));
  });

  it("B misses an effect the paired test finds on identical counts", () => {
    const tight = pc(64, 52, 16, 4); // from the report's example 4
    expect(diablo(data([tight, NULL, NULL], 0)).blamed).toEqual([0]);
    expect(unpaired(data([tight, NULL, NULL], 0)).blamed).toEqual([]);
  });

  it("C (uncorrected) judges each raw p on its own", () => {
    const borderline = pc(70, 60, 13, 3);
    const r = uncorrected(data([borderline, NULL, NULL, NULL], 0));
    expect(r.p[0]).toBe(mcnemarExact(13, 3));
    expect(r.blamed).toEqual([0]);
    expect(uncorrected(data([pc(57, 69, 4, 16), NULL], null)).blamed).toEqual([]);
  });

  it("D (largest drop) blames the biggest observed drop with no test", () => {
    expect(largest(data([pc(60, 58, 4, 2), pc(60, 55, 7, 2), NULL], 0)).blamed).toEqual([1]);
    expect(largest(data([pc(60, 58, 4, 2)], null)).blamed).toEqual([0]); // even a 2-item drop
  });

  it("D breaks ties by order and names nothing when no factor dropped", () => {
    expect(largest(data([NULL, pc(60, 57, 5, 2), pc(60, 57, 4, 1)], 2)).blamed).toEqual([1]);
    expect(largest(data([NULL, pc(55, 60, 2, 7)], null)).blamed).toEqual([]);
  });
});

describe("scoring against the planted truth", () => {
  it("separates right, wrong, missed, quiet and false alarm", () => {
    expect(score([1], 1)).toBe("correct");
    expect(score([0], 1)).toBe("wrong");
    expect(score([0, 1], 1)).toBe("wrong"); // the true cause plus an innocent one
    expect(score([], 1)).toBe("missed");
    expect(score([], null)).toBe("quiet");
    expect(score([2], null)).toBe("false-alarm");
  });
});
