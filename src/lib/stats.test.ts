import { describe, expect, it } from "vitest";
import {
  bootstrapDiffCI,
  cohensH,
  fisherExact,
  formatP,
  formatPP,
  holm,
  mcnemarExact,
  newcombe,
  pairsFromTable,
  twoProportionZ,
  wilson,
} from "./stats";

// Reference values checked with SciPy / statsmodels (see the redesign brief, section 6).
const close = (a: number, b: number, tol = 5e-5) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe("wilson", () => {
  it("matches reference intervals", () => {
    const [a, b] = wilson(165, 400);
    close(a, 0.3653);
    close(b, 0.4614);
    const [c, d] = wilson(199, 400);
    close(c, 0.4488);
    close(d, 0.5463);
  });
  it("handles the edges", () => {
    const [a, b] = wilson(0, 50);
    expect(a).toBe(0);
    close(b, 0.0713);
    const [c, d] = wilson(50, 50);
    close(c, 0.9287);
    expect(d).toBe(1);
  });
});

describe("independent proportions, 165/400 vs 199/400", () => {
  it("difference and Newcombe CI", () => {
    expect(199 / 400 - 165 / 400).toBeCloseTo(0.085, 10);
    const [lo, hi] = newcombe(165, 400, 199, 400);
    close(lo, 0.016);
    close(hi, 0.1529);
  });
  it("two-proportion z-test", () => {
    const { z, p } = twoProportionZ(165, 400, 199, 400);
    close(z, 2.414, 5e-4);
    close(p, 0.0158, 5e-5);
  });
  it("Cohen's h", () => {
    close(cohensH(165 / 400, 199 / 400), 0.171, 5e-4);
  });
});

describe("exact tests", () => {
  it("Fisher's exact test", () => {
    close(fisherExact([[3, 17], [11, 9]]), 0.0187, 5e-5);
  });
  it("Fisher is symmetric and bounded", () => {
    expect(fisherExact([[5, 5], [5, 5]])).toBeCloseTo(1, 10);
  });
  it("exact McNemar", () => {
    close(mcnemarExact(30, 64), 0.00059, 1e-5);
    expect(mcnemarExact(0, 0)).toBe(1);
    expect(mcnemarExact(10, 10)).toBeCloseTo(1, 10);
  });
});

describe("holm", () => {
  it("adjusts in input order", () => {
    const adj = holm([0.004, 0.0007, 0.62]);
    close(adj[0], 0.008, 1e-12);
    close(adj[1], 0.0021, 1e-12);
    close(adj[2], 0.62, 1e-12);
  });
  it("is monotone and capped at 1", () => {
    expect(holm([0.5, 0.6])).toEqual([1, 1]);
  });
});

describe("bootstrap", () => {
  it("is reproducible with a seed", () => {
    const { control, treatment } = pairsFromTable(100, 20, 40, 240);
    const a = bootstrapDiffCI(control, treatment, { paired: true, seed: 7 });
    const b = bootstrapDiffCI(control, treatment, { paired: true, seed: 7 });
    expect(a).toEqual(b);
    // Δ = (40 − 20) / 400 = 0.05, and the interval should contain it.
    expect(a[0]).toBeLessThan(0.05);
    expect(a[1]).toBeGreaterThan(0.05);
  });
});

describe("formatting", () => {
  it("formats p without exponents", () => {
    expect(formatP(0.0158)).toBe("p = 0.016");
    expect(formatP(0.00059)).toBe("p < 0.001");
    expect(formatP(0.21)).toBe("p = 0.21");
    expect(formatP(0.0004)).not.toMatch(/e/);
  });
  it("formats percentage points with a real minus sign", () => {
    expect(formatPP(0.085)).toBe("+8.5 pp");
    expect(formatPP(-0.043)).toBe("−4.3 pp");
    expect(formatPP(0)).toBe("0.0 pp");
    expect(formatPP(-0.0001)).toBe("0.0 pp");
  });
});
