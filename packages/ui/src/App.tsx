/**
 * Stage 1 placeholder shell. The run list, execution tree, inspector, diff view
 * and scrubber land in Stages 3–4; for now we render the empty state so the app
 * builds and has somewhere to grow.
 */
export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="logo">tracebird</span>
        <span className="tagline">time-travel debugger for AI agents</span>
      </header>
      <main className="empty-state">
        <h1>Waiting for your first agent run…</h1>
        <p>
          Point your agent's OpenTelemetry exporter at the local receiver and trigger a run:
        </p>
        <pre>export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318</pre>
      </main>
    </div>
  );
}
