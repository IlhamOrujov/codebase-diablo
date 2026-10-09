/**
 * Hard limits on what one live investigation may spend. Pure and shared by
 * the server (which enforces them) and the page (which shows the estimate
 * before anyone presses Run).
 */

export interface LiveCaps {
  /** Experiments the plan may contain (each has two arms). */
  maxExperiments: number;
  /** Items per arm, upper bound for the plan. */
  maxItemsPerArm: number;
  /** Items per arm, lower bound: fewer pairs cannot show anything. */
  minItemsPerArm: number;
  /** Target calls in flight at once. */
  concurrency: number;
  /** Timeout for one target call (ms). */
  targetTimeoutMs: number;
  /** Timeout for one reasoning call (ms). */
  reasoningTimeoutMs: number;
  /** The RUN stage stops starting calls after this long (ms); unfinished pairs are left out. */
  runDeadlineMs: number;
}

/** Defaults and absolute ceilings. Environment overrides are clamped into [min, ceiling]. */
export const CAP_LIMITS = {
  maxExperiments: { def: 2, min: 2, max: 3 },
  maxItemsPerArm: { def: 40, min: 10, max: 100 },
  concurrency: { def: 4, min: 1, max: 8 },
  targetTimeoutMs: { def: 30_000, min: 5_000, max: 120_000 },
  reasoningTimeoutMs: { def: 90_000, min: 10_000, max: 180_000 },
  runDeadlineMs: { def: 180_000, min: 30_000, max: 270_000 },
} as const;

export const MIN_ITEMS_PER_ARM = 10;

/** Planning: one draft plus at most two repairs. */
export const MAX_DRAFT_CALLS = 3;
/** Interpretation: one attempt plus one retry, then the code-built summary. */
export const MAX_INTERPRET_CALLS = 2;

export const DEFAULT_CAPS: LiveCaps = {
  maxExperiments: CAP_LIMITS.maxExperiments.def,
  maxItemsPerArm: CAP_LIMITS.maxItemsPerArm.def,
  minItemsPerArm: MIN_ITEMS_PER_ARM,
  concurrency: CAP_LIMITS.concurrency.def,
  targetTimeoutMs: CAP_LIMITS.targetTimeoutMs.def,
  reasoningTimeoutMs: CAP_LIMITS.reasoningTimeoutMs.def,
  runDeadlineMs: CAP_LIMITS.runDeadlineMs.def,
};

export interface CallEstimate {
  draft: number;
  target: number;
  interpret: number;
  total: number;
}

/**
 * The most model calls one run can make. The real number is usually lower:
 * an arm configuration shared by two experiments is called once per item.
 */
export function maxCalls(caps: LiveCaps): CallEstimate {
  const target = caps.maxExperiments * 2 * caps.maxItemsPerArm;
  return { draft: MAX_DRAFT_CALLS, target, interpret: MAX_INTERPRET_CALLS, total: MAX_DRAFT_CALLS + target + MAX_INTERPRET_CALLS };
}
