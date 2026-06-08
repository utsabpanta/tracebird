import { useEffect, useState } from 'react';
import type { DiffSegment, FieldChange, NodeDiff, RunDiff } from '@tracebird/core';
import { api, type RunSummary } from '../api.js';
import { KIND_META } from '../nodeMeta.js';

interface DiffViewProps {
  runs: RunSummary[];
}

export function DiffView({ runs }: DiffViewProps) {
  const [aId, setAId] = useState<string>();
  const [bId, setBId] = useState<string>();
  const [diff, setDiff] = useState<RunDiff>();
  const [error, setError] = useState<string>();

  // Default to the two most recent runs.
  useEffect(() => {
    if (!aId && runs[1]) setAId(runs[1].id);
    if (!bId && runs[0]) setBId(runs[0].id);
  }, [runs, aId, bId]);

  useEffect(() => {
    if (!aId || !bId) return;
    let cancelled = false;
    api
      .diff(aId, bId)
      .then((d) => !cancelled && (setDiff(d), setError(undefined)))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [aId, bId]);

  if (runs.length < 2) {
    return (
      <div className="empty-state">
        <p>Capture at least two runs to diff them.</p>
      </div>
    );
  }

  return (
    <div className="diff-view">
      <div className="diff-pickers">
        <RunPicker label="A" runs={runs} value={aId} onChange={setAId} side="a" />
        <span className="diff-arrow">→</span>
        <RunPicker label="B" runs={runs} value={bId} onChange={setBId} side="b" />
      </div>

      {error && <p className="badge badge-error">{error}</p>}

      {diff && (
        <div className="diff-body">
          {diff.fields.length > 0 && (
            <section className="diff-section">
              <h3>Run</h3>
              <FieldChanges fields={diff.fields} />
            </section>
          )}
          <section className="diff-section">
            <h3>Tree</h3>
            {diff.changed ? (
              <DiffTreeNode node={diff.root} />
            ) : (
              <p className="muted">No differences — these runs are identical.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function RunPicker({
  label,
  runs,
  value,
  onChange,
  side,
}: {
  label: string;
  runs: RunSummary[];
  value: string | undefined;
  onChange: (id: string) => void;
  side: 'a' | 'b';
}) {
  return (
    <label className={`run-picker run-picker-${side}`}>
      <span className="run-picker-label">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.summary}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldChanges({ fields }: { fields: FieldChange[] }) {
  return (
    <table className="field-changes">
      <tbody>
        {fields.map((f) => (
          <tr key={f.field}>
            <td className="field-name">{f.field}</td>
            <td className="field-a">{String(f.a)}</td>
            <td className="field-arrow">→</td>
            <td className="field-b">{String(f.b)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiffTreeNode({ node }: { node: NodeDiff }) {
  // Skip subtrees with no changes to keep the diff focused.
  if (node.status === 'unchanged' && !hasChange(node)) return null;
  const meta = node.kind ? KIND_META[node.kind] : undefined;
  const name = node.name.b ?? node.name.a ?? '(node)';

  return (
    <div className={`diff-node diff-${node.status}`}>
      <div className="diff-node-head">
        <span className={`diff-status-tag tag-${node.status}`}>{node.status}</span>
        {meta && (
          <span className="tree-icon" style={{ color: meta.color }}>
            {meta.icon}
          </span>
        )}
        <span className="diff-node-name">{name}</span>
      </div>
      {node.status !== 'unchanged' && node.fields.length > 0 && (
        <FieldChanges fields={node.fields} />
      )}
      {node.texts
        .filter((t) => t.changed)
        .map((t) => (
          <div className="diff-text" key={t.label}>
            <div className="diff-text-label">{t.label}</div>
            <TextDiffView segments={t.segments} />
          </div>
        ))}
      {node.children.map((child, i) => (
        <DiffTreeNode key={child.aId ?? child.bId ?? i} node={child} />
      ))}
    </div>
  );
}

function hasChange(node: NodeDiff): boolean {
  if (node.status !== 'unchanged') return true;
  return node.children.some(hasChange);
}

export function TextDiffView({ segments }: { segments: DiffSegment[] }) {
  return (
    <pre className="text-diff">
      {segments.map((seg, i) => (
        <span key={i} className={`seg seg-${seg.type}`}>
          {seg.value}
        </span>
      ))}
    </pre>
  );
}
