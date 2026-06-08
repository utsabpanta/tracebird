/** Presentation helpers shared across the UI views. Pure + unit-tested. */

/** Format a millisecond duration compactly (e.g. `820ms`, `1.25s`, `1m 4s`). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2).replace(/\.?0+$/, '')}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${mins}m ${rem}s`;
}

/** Format a token count with thousands separators, or `—` when unknown. */
export function formatTokens(tokens: number | undefined): string {
  if (tokens == null) return '—';
  return tokens.toLocaleString('en-US');
}

/** Format an estimated USD cost, or `—` when the model price is unknown. */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return '—';
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
