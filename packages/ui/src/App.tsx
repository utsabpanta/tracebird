import { useEffect, useMemo, useState } from 'react';
import type { Run, TraceNode } from '@tracebird/core';
import { api, type RunSummary, type SessionInfo } from './api.js';
import { RunList } from './components/RunList.js';
import { ExecutionTree } from './components/ExecutionTree.js';
import { Inspector } from './components/Inspector.js';
import { formatCost, formatDuration, formatTokens } from './format.js';

function findNode(node: TraceNode, id: string | undefined): TraceNode | undefined {
  if (!id) return undefined;
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

export function App() {
  const [session, setSession] = useState<SessionInfo>();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [run, setRun] = useState<Run>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [error, setError] = useState<string>();

  // Poll the session + run list (live mode keeps appending).
  useEffect(() => {
    let cancelled = false;
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
    const interval = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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
        setSelectedNodeId(r.root.id);
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="logo">tracebird</span>
        <span className="tagline">time-travel debugger for AI agents</span>
        <span className="spacer" />
        {error && <span className="badge badge-error">{error}</span>}
        {session?.live && <span className="badge badge-live">● live</span>}
        <span className="run-count">
          {runs.length} run{runs.length === 1 ? '' : 's'}
        </span>
      </header>

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
