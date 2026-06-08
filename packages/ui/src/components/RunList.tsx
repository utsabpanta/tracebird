import type { RunSummary } from '../api.js';
import { formatCost, formatDuration, formatTokens } from '../format.js';

interface RunListProps {
  runs: RunSummary[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function RunList({ runs, selectedId, onSelect }: RunListProps) {
  if (runs.length === 0) {
    return <p className="sidebar-empty">No runs captured yet.</p>;
  }
  return (
    <ul className="run-list">
      {runs.map((run) => (
        <li key={run.id}>
          <button
            type="button"
            className={`run-item${run.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(run.id)}
          >
            <span className="run-item-top">
              <span className={`status-dot status-${run.status}`} aria-hidden />
              <span className="run-summary" title={run.summary}>
                {run.summary}
              </span>
            </span>
            <span className="run-item-meta">
              <span>{formatDuration(run.durationMs)}</span>
              <span>{formatTokens(run.tokens.total)}</span>
              <span>{formatCost(run.costUsd)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
