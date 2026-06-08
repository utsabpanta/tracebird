/** Compact formatters for terminal output. */

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2).replace(/\.?0+$/, '')}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${mins}m ${rem}s`;
}

export function formatTokens(tokens: number | undefined): string | undefined {
  return tokens == null ? undefined : `${tokens.toLocaleString('en-US')} tok`;
}

export function formatCost(usd: number | null | undefined): string | undefined {
  if (usd == null) return undefined;
  if (usd === 0) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
