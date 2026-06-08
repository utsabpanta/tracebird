import { useState } from 'react';
import type { LlmCall, ToolCall, TraceNode } from '@tracebird/core';
import { KIND_META } from '../nodeMeta.js';
import { formatCost, formatDuration, formatTokens } from '../format.js';

interface ExecutionTreeProps {
  root: TraceNode;
  selectedId: string | undefined;
  onSelect: (node: TraceNode) => void;
}

/** The execution tree: collapsible run → step → LLM/tool hierarchy. */
export function ExecutionTree({ root, selectedId, onSelect }: ExecutionTreeProps) {
  return (
    <div className="tree" role="tree">
      <TreeRow node={root} depth={0} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

function nodeMetrics(node: TraceNode): string[] {
  const out = [formatDuration(node.durationMs)];
  if (node.kind === 'llm') {
    const llm = node as LlmCall;
    const tok = formatTokens(llm.usage.total ?? llm.usage.input);
    if (llm.usage.total != null || llm.usage.input != null) out.push(tok);
    if (llm.costUsd != null) out.push(formatCost(llm.costUsd));
  }
  return out;
}

interface TreeRowProps {
  node: TraceNode;
  depth: number;
  selectedId: string | undefined;
  onSelect: (node: TraceNode) => void;
}

function TreeRow({ node, depth, selectedId, onSelect }: TreeRowProps) {
  const [expanded, setExpanded] = useState(true);
  const meta = KIND_META[node.kind];
  const hasChildren = node.children.length > 0;
  const isError = node.kind === 'tool' && (node as ToolCall).isError;

  return (
    <div className="tree-branch" role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className={`tree-row${node.id === selectedId ? ' selected' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(node)}
      >
        <button
          type="button"
          className="tree-toggle"
          aria-label={expanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((v) => !v);
          }}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : ''}
        </button>
        <span className="tree-icon" style={{ color: meta.color }}>
          {meta.icon}
        </span>
        <span className="tree-name">{node.name}</span>
        {isError && <span className="badge badge-error">error</span>}
        <span className="tree-metrics">
          {nodeMetrics(node).map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
