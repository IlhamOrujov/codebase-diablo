/**
 * Statistics used by every number the UI shows. Pure functions, no
 * dependencies, unit-tested against reference values computed with SciPy
 * (src/lib/stats.test.ts). Fixtures store counts only; every p-value,
 * confidence interval and effect size on screen comes from here.
 *
 * Conventions: proportions are 0..1; a difference is treatment − control.
 */

/** Two-sided 95% critical value of the standard normal. */
export const Z95 = 1.959963984540054;

export type Interval = [number, number];

/* ── Distributions ─────────────────────────────────────────────── */

/**
 * Complementary error function (Numerical Recipes "erfcc", Chebyshev fit,
 * fractional error < 1.2e-7 everywhere). Far more precise than anything we print.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Two-sided p-value for a standard normal statistic. */
export function twoSidedP(z: number): number {
  return Math.min(1, erfc(Math.abs(z) / Math.SQRT2));
}

const LOG_FACT: number[] = [0];
function logFactorial(n: number): number {
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i);
  return LOG_FACT[n];
}
function logChoose(n: number, k: number): number {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/* ── Proportions ───────────────────────────────────────────────── */

/** Wilson score interval for k successes out of n. */
export function wilson(k: number, n: number, z = Z95): Interval {
  if (n <= 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  // The bounds are exactly 0 and 1 at the edges; avoid float residue like 7e-18.
  return [k <= 0 ? 0 : Math.max(0, centre - half), k >= n ? 1 : Math.min(1, centre + half)];
}

/**
 * Newcombe's hybrid score interval (method 10) for the difference of two
 * independent proportions, p2 − p1 (arm 2 minus arm 1).
 */
export function newcombe(k1: number, n1: number, k2: number, n2: number, z = Z95): Interval {
  const p1 = k1 / n1;
  const p2 = k2 / n2;
  const [l1, u1] = wilson(k1, n1, z);
  const [l2, u2] = wilson(k2, n2, z);
  const d = p2 - p1;
  const lower = d - Math.sqrt((p2 - l2) ** 2 + (u1 - p1) ** 2);
  const upper = d + Math.sqrt((u2 - p2) ** 2 + (p1 - l1) ** 2);
  return [lower, upper];
}

/** Pooled two-proportion z-test, arm 2 vs arm 1. Equivalent to a 2×2 chi-squared test (same p). */
export function twoProportionZ(k1: number, n1: number, k2: number, n2: number): { z: number; p: number } {
  const p1 = k1 / n1;
  const p2 = k2 / n2;
  const pooled = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, p: 1 };
  const z = (p2 - p1) / se;
  return { z, p: twoSidedP(z) };
}

/**
 * Fisher's exact test on a 2×2 table [[a, b], [c, d]], two-sided:
 * the sum of probabilities of every table with the same margins that is no
 * more likely than the observed one.
 */
export function fisherExact(table: [[number, number], [number, number]]): number {
  const [[a, b], [c, d]] = table;
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = r1 + r2;
  const logP = (x: number) => logChoose(r1, x) + logChoose(r2, c1 - x) - logChoose(n, c1);
  const observed = logP(a);
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  let p = 0;
  for (let x = lo; x <= hi; x++) {
    const lp = logP(x);
    if (lp <= observed + 1e-7) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

/**
 * Exact McNemar test for paired binary outcomes. b and c are the discordant
 * pairs (control positive / treatment negative, and the reverse).
 */
export function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const m = Math.min(b, c);
  let tail = 0;
  for (let i = 0; i <= m; i++) tail += Math.exp(logChoose(n, i) - n * Math.LN2);
  return Math.min(1, 2 * tail);
}

/** Cohen's h for two proportions (p2 vs p1). */
export function cohensH(p1: number, p2: number): number {
  return 2 * Math.asin(Math.sqrt(p2)) - 2 * Math.asin(Math.sqrt(p1));
}

/* ── Resampling ────────────────────────────────────────────────── */

/** Small, fast, seeded PRNG (mulberry32). Same seed, same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return xs.length ? s / xs.length : NaN;
};

/**
 * Percentile bootstrap CI for mean(treatment) − mean(control).
 * Paired: resample pairs (arrays must be the same length, index i is one unit).
 * Independent: resample each arm separately. Seeded, so the result is reproducible.
 */
export function bootstrapDiffCI(
  control: number[],
  treatment: number[],
  { paired, iterations = 2000, seed = 1, level = 0.95 }: { paired: boolean; iterations?: number; seed?: number; level?: number },
): Interval {
  const rand = mulberry32(seed);
  const diffs = new Float64Array(iterations);
  const n1 = control.length;
  const n2 = treatment.length;
  if (paired && n1 !== n2) throw new Error("Paired bootstrap needs arms of equal length");
  for (let it = 0; it < iterations; it++) {
    if (paired) {
      let s = 0;
      for (let i = 0; i < n1; i++) {
        const j = Math.floor(rand() * n1);
        s += treatment[j] - control[j];
      }
      diffs[it] = s / n1;
    } else {
      let s1 = 0;
      let s2 = 0;
      for (let i = 0; i < n1; i++) s1 += control[Math.floor(rand() * n1)];
      for (let i = 0; i < n2; i++) s2 += treatment[Math.floor(rand() * n2)];
      diffs[it] = s2 / n2 - s1 / n1;
    }
  }
  diffs.sort();
  const alpha = (1 - level) / 2;
  const at = (q: number) => diffs[Math.min(iterations - 1, Math.max(0, Math.floor(q * iterations)))];
  return [at(alpha), at(1 - alpha)];
}

/** Rebuild per-pair 0/1 outcomes from a paired 2×2 table (a: both positive, b: control only, c: treatment only, d: neither). */
export function pairsFromTable(a: number, b: number, c: number, d: number): { control: number[]; treatment: number[] } {
  const control: number[] = [];
  const treatment: number[] = [];
  const push = (x: number, y: number, times: number) => {
    for (let i = 0; i < times; i++) {
      control.push(x);
      treatment.push(y);
    }
  };
  push(1, 1, a);
  push(1, 0, b);
  push(0, 1, c);
  push(0, 0, d);
  return { control, treatment };
}

export { mean };

/* ── Multiple comparisons ──────────────────────────────────────── */

/** Holm–Bonferroni adjusted p-values, returned in the input order. */
export function holm(ps: number[]): number[] {
  const m = ps.length;
  const order = ps.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p);
  const adjusted = new Array<number>(m);
  let running = 0;
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}

/* ── Formatting ────────────────────────────────────────────────── */

const MINUS = "−";

function fixed(x: number, digits: number) {
  // Avoid "-0.0"
  const s = Math.abs(x).toFixed(digits);
  const zero = Number(s) === 0;
  return { s, negative: x < 0 && !zero };
}

/** "p = 0.016", "p < 0.001", never exponent notation. */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return "p not computed";
  if (p < 0.001) return "p < 0.001";
  if (p > 0.99) return "p > 0.99";
  return `p = ${p < 0.1 ? p.toFixed(3) : p.toFixed(2)}`;
}

/** A difference in proportions as percentage points: "+8.5 pp", "−4.3 pp". */
export function formatPP(d: number, digits = 1): string {
  const { s, negative } = fixed(d * 100, digits);
  if (Number(s) === 0) return `${s} pp`;
  return `${negative ? MINUS : "+"}${s} pp`;
}

/** A signed number with a real minus sign. */
export function signed(x: number, digits = 2): string {
  const { s, negative } = fixed(x, digits);
  if (Number(s) === 0) return s;
  return `${negative ? MINUS : "+"}${s}`;
}

/** A plain number with a real minus sign (no plus). */
export function num(x: number, digits = 1): string {
  const { s, negative } = fixed(x, digits);
  return `${negative ? MINUS : ""}${s}`;
}

/** A proportion as a percentage: "41.3%". */
export function formatPct(p: number, digits = 1): string {
  return `${num(p * 100, digits)}%`;
}

/** A CI of a difference in pp: "1.6 to 15.3" (units given by the caller). */
export function formatCIpp([lo, hi]: Interval, digits = 1): string {
  return `${num(lo * 100, digits)} to ${num(hi * 100, digits)}`;
}
