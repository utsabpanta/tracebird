import type { Run, RunDiff, TokenUsage } from '@tracebird/core';

/** Mirror of the CLI's `RunSummary` shape (the `/api/runs` payload). */
export interface RunSummary {
  id: string;
  traceId: string;
  summary: string;
  startTimeUnixNano: string;
  durationMs: number;
  status: 'ok' | 'error' | 'unset';
  tokens: TokenUsage;
  costUsd: number | null;
  service?: string;
  nodeCount: number;
}

export interface SessionInfo {
  live: boolean;
  filePath: string | null;
  count: number;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  session: () => getJson<SessionInfo>('/api/session'),
  runs: () => getJson<RunSummary[]>('/api/runs'),
  run: (id: string) => getJson<Run>(`/api/runs/${encodeURIComponent(id)}`),
  diff: (a: string, b: string) =>
    getJson<RunDiff>(`/api/diff?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
};
