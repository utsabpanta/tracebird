import type { TokenUsage } from './types.js';

/**
 * Cost estimation is **pluggable** and intentionally conservative.
 *
 * LLM prices change often, so we never want to hardcode numbers that silently
 * go stale. The default table below is a small, clearly-dated set of indicative
 * prices; any model not in the table yields `null` ("unknown") rather than a
 * wrong number. Callers can pass their own table to {@link estimateCost}.
 */

export interface ModelPrice {
  /** USD per 1M input (prompt) tokens. */
  inputPerMTok: number;
  /** USD per 1M output (completion) tokens. */
  outputPerMTok: number;
}

export type PriceTable = Record<string, ModelPrice>;

/**
 * Indicative public list prices, USD per 1M tokens. Snapshot — treat as a
 * starting point and override via {@link estimateCost}'s `prices` argument.
 * Last reviewed: 2026-06.
 */
export const DEFAULT_PRICES: PriceTable = {
  'gpt-4o': { inputPerMTok: 2.5, outputPerMTok: 10 },
  'gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  'gpt-4.1': { inputPerMTok: 2, outputPerMTok: 8 },
  'gpt-4.1-mini': { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  'gpt-4-turbo': { inputPerMTok: 10, outputPerMTok: 30 },
  'gpt-3.5-turbo': { inputPerMTok: 0.5, outputPerMTok: 1.5 },
  'o3-mini': { inputPerMTok: 1.1, outputPerMTok: 4.4 },
  'claude-3-5-sonnet': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-3-5-haiku': { inputPerMTok: 0.8, outputPerMTok: 4 },
  'claude-3-opus': { inputPerMTok: 15, outputPerMTok: 75 },
  'claude-sonnet-4': { inputPerMTok: 3, outputPerMTok: 15 },
};

/** Normalize a model id for price lookup (drop a trailing `-YYYY-MM-DD` date). */
export function normalizeModel(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-latest$/, '');
}

function lookupPrice(model: string, prices: PriceTable): ModelPrice | undefined {
  if (prices[model]) return prices[model];
  const normalized = normalizeModel(model);
  if (prices[normalized]) return prices[normalized];
  // Longest known key that prefixes the model (e.g. "claude-3-5-sonnet-...").
  let best: ModelPrice | undefined;
  let bestLen = 0;
  for (const [key, price] of Object.entries(prices)) {
    if (normalized.startsWith(key) && key.length > bestLen) {
      best = price;
      bestLen = key.length;
    }
  }
  return best;
}

/**
 * Estimate the USD cost of an LLM call from its token usage and model. Returns
 * `null` when the model is unknown or token counts are missing — never a guess.
 */
export function estimateCost(
  model: string | undefined,
  usage: TokenUsage,
  prices: PriceTable = DEFAULT_PRICES,
): number | null {
  if (!model) return null;
  const price = lookupPrice(model, prices);
  if (!price) return null;
  if (usage.input == null && usage.output == null) return null;
  const input = (usage.input ?? 0) / 1_000_000;
  const output = (usage.output ?? 0) / 1_000_000;
  return input * price.inputPerMTok + output * price.outputPerMTok;
}
