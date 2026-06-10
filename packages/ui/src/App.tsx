import { useEffect, useMemo, useState } from 'react';
import type { Run, TraceNode } from '@tracebird/core';
import { api, type RunSummary, type SessionInfo } from './api.js';
import { RunList } from './components/RunList.js';
import { ExecutionTree } from './components/ExecutionTree.js';
import { Inspector } from './components/Inspector.js';
import { Scrubber } from './components/Scrubber.js';
import { DiffView } from './components/DiffView.js';
import { flattenByTime, flattenInOrder } from './tree-util.js';
import { formatCost, formatDuration, formatTokens } from './format.js';

type Mode = 'inspect' | 'diff';

function findNode(node: TraceNode, id: string | undefined): TraceNode | undefined {
  if (!id) return undefined;
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

/** Default node selection: the first LLM call (most informative), else the root. */
function defaultNodeId(root: TraceNode): string {
  const all = flattenInOrder(root);
  return (all.find((n) => n.kind === 'llm') ?? all.find((n) => n.kind === 'tool') ?? root).id;
}

export function App() {
  const [session, setSession] = useState<SessionInfo>();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [run, setRun] = useState<Run>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<Mode>('inspect');
  const [receiving, setReceiving] = useState(false);

  // Keep the session + run list fresh. We push instantly via SSE and keep a
  // slow poll as a fallback for environments without EventSource.
  useEffect(() => {
    let cancelled = false;
    let pulse: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const [s, r] = await Promise.all([api.session(), api.runs()]);
        if (cancelled) return;
        setSession(s);
        setRuns(r);
        setError(undefined);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), 8000);

    let es: EventSource | undefined;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource('/api/stream');
      es.addEventListener('run', () => void tick());
      es.addEventListener('activity', () => {
        setReceiving(true);
        clearTimeout(pulse);
        pulse = setTimeout(() => setReceiving(false), 1200);
      });
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(pulse);
      es?.close();
    };
  }, []);

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) setSelectedRunId(runs[0].id);
  }, [runs, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) {
      setRun(undefined);
      return;
    }
    let cancelled = false;
    api
      .run(selectedRunId)
      .then((r) => {
        if (cancelled) return;
        setRun(r);
        setSelectedNodeId(defaultNodeId(r.root));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  const selectedNode = useMemo(
    () => (run ? findNode(run.root, selectedNodeId) : undefined),
    [run, selectedNodeId],
  );
  const timeline = useMemo(() => (run ? flattenByTime(run.root) : []), [run]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="logo">tracebird</span>
        <span className="tagline">time-travel debugger for AI agents</span>
        <div className="mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'inspect'}
            className={mode === 'inspect' ? 'active' : ''}
            onClick={() => setMode('inspect')}
          >
            Inspect
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'diff'}
            className={mode === 'diff' ? 'active' : ''}
            onClick={() => setMode('diff')}
          >
            Diff
          </button>
        </div>
        <span className="spacer" />
        {error && <span className="badge badge-error">{error}</span>}
        {receiving && <span className="badge badge-activity">● receiving spans…</span>}
        {session?.live && <span className="badge badge-live">● live</span>}
        <span className="run-count">
          {runs.length} run{runs.length === 1 ? '' : 's'}
        </span>
      </header>

      {mode === 'diff' ? (
        <div className="layout-diff">
          <DiffView runs={runs} />
        </div>
      ) : (
        <div className="layout">
          <aside className="sidebar">
            <h2 className="pane-title">Runs</h2>
            <RunList runs={runs} selectedId={selectedRunId} onSelect={setSelectedRunId} />
          </aside>

          <section className="main">
            {run ? (
              <>
                <div className="run-bar">
                  <div className="run-bar-summary" title={run.summary}>
                    {run.summary}
                  </div>
                  <div className="run-bar-metrics">
                    <span>{formatDuration(run.durationMs)}</span>
                    <span>{formatTokens(run.tokens.total)} tokens</span>
                    <span>{formatCost(run.costUsd)}</span>
                    {run.service && <span className="muted">{run.service}</span>}
                  </div>
                </div>
                <Scrubber
                  timeline={timeline}
                  selectedId={selectedNodeId}
                  onSelect={(node) => setSelectedNodeId(node.id)}
                />
                <ExecutionTree
                  root={run.root}
                  selectedId={selectedNodeId}
                  onSelect={(node) => setSelectedNodeId(node.id)}
                />
              </>
            ) : (
              <EmptyState live={session?.live ?? false} />
            )}
          </section>

          <aside className="inspector-pane">
            <h2 className="pane-title">Inspector</h2>
            <Inspector node={selectedNode} />
          </aside>
        </div>
      )}
    </div>
  );
}

function EmptyState({ live }: { live: boolean }) {
  return (
    <div className="empty-state">
      <h1>Waiting for your first agent run…</h1>
      {live ? (
        <>
          <p>Point your agent's OpenTelemetry exporter at the local receiver and trigger a run:</p>
          <pre>export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318</pre>
        </>
      ) : (
        <p>This session has no runs.</p>
      )}
    </div>
  );
}
