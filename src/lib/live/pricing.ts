/**
 * Claude list prices, USD per million tokens, from
 * https://platform.claude.com/docs/en/about-claude/pricing (read 9 Oct 2026).
 * Client-safe: used to put a price on a finished run's measured tokens.
 *
 * Claude Haiku 5.5's prices are for prompts up to 100,000 tokens (every live
 * prompt is far shorter). Cache hits are listed for completeness: the engine
 * sends no cache_control, so its runs pay the base input price throughout.
 * Other providers' models have no entry: no cost is shown for them.
 */
export interface Price {
  input: number;
  cacheHit: number;
  output: number;
}

export const CLAUDE_PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, cacheHit: 0.2, output: 20 },
  "claude-haiku-5-5": { input: 0.1, cacheHit: 0.01, output: 0.5 },
  "claude-haiku-4-5": { input: 1, cacheHit: 0.1, output: 5 },
};

/** The price of a model id, also for a dated snapshot such as claude-haiku-4-5-20251001. */
export function priceOf(model: string): Price | null {
  const id = model.trim().toLowerCase();
  return CLAUDE_PRICES[id] ?? CLAUDE_PRICES[id.replace(/-\d{8}$/, "")] ?? null;
}

interface Tokens {
  inputTokens: number;
  outputTokens: number;
}

const cost = (p: Price, t: Tokens) => (t.inputTokens * p.input + t.outputTokens * p.output) / 1_000_000;

/**
 * What a run's measured tokens cost at list price: planning and the
 * conclusion at the reasoning model's price, the target calls at the target's.
 * Null when either model has no known price.
 */
export function runCostUsd(
  models: { reasoning: string; target: string },
  byStage: { draft: Tokens; run: Tokens; interpret: Tokens },
): { reasoning: number; target: number; total: number } | null {
  const r = priceOf(models.reasoning);
  const t = priceOf(models.target);
  if (!r || !t) return null;
  const reasoning = cost(r, byStage.draft) + cost(r, byStage.interpret);
  const target = cost(t, byStage.run);
  return { reasoning, target, total: reasoning + target };
}

/** "$1.24" from a dollar up; below it, two significant digits ("$0.50", "$0.012"), never fewer than cents. */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd < 0.000001) return "under $0.000001";
  const decimals = Math.min(6, Math.max(2, Math.ceil(-Math.log10(usd)) + 1));
  return `$${usd.toFixed(decimals)}`;
}
