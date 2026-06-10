import { diffRuns, runMatches, type Run, type RunDiff, type TokenUsage } from '@tracebird/core';

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

export interface Api {
  session: () => Promise<SessionInfo>;
  runs: (query?: string, status?: string) => Promise<RunSummary[]>;
  run: (id: string) => Promise<Run>;
  diff: (a: string, b: string) => Promise<RunDiff>;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

const networkApi: Api = {
  session: () => getJson<SessionInfo>('/api/session'),
  runs: (query, status) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status && status !== 'all') params.set('status', status);
    const qs = params.toString();
    return getJson<RunSummary[]>(`/api/runs${qs ? `?${qs}` : ''}`);
  },
  run: (id) => getJson<Run>(`/api/runs/${encodeURIComponent(id)}`),
  diff: (a, b) =>
    getJson<RunDiff>(`/api/diff?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
};

// ---------------------------------------------------------------------------
// Snapshot mode: an exported self-contained HTML page embeds the data on
// `window.__TRACEBIRD_SNAPSHOT__` and serves everything offline, no fetch.
// ---------------------------------------------------------------------------

interface Snapshot {
  session: SessionInfo;
  runs: RunSummary[];
  runsById: Record<string, Run>;
}

const snapshot = (globalThis as { __TRACEBIRD_SNAPSHOT__?: Snapshot }).__TRACEBIRD_SNAPSHOT__;

export const isSnapshot = Boolean(snapshot);

function snapshotApi(data: Snapshot): Api {
  return {
    session: async () => data.session,
    runs: async (query, status) =>
      data.runs.filter((s) => {
        if (status && status !== 'all' && s.status !== status) return false;
        const run = data.runsById[s.id];
        return run ? runMatches(run, query ?? '') : true;
      }),
    run: async (id) => data.runsById[id],
    diff: async (a, b) => diffRuns(data.runsById[a], data.runsById[b]),
  };
}

export const api: Api = snapshot ? snapshotApi(snapshot) : networkApi;
