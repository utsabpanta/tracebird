import { compareNano, type TraceNode } from '@tracebird/core';

/** All nodes in depth-first (tree) order. */
export function flattenInOrder(root: TraceNode): TraceNode[] {
  const out: TraceNode[] = [];
  const walk = (node: TraceNode) => {
    out.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return out;
}

/**
 * All nodes ordered by start time — the axis the scrubber moves along.
 * The synthetic run root is dropped so the slider spans real events only.
 */
export function flattenByTime(root: TraceNode): TraceNode[] {
  return flattenInOrder(root)
    .filter((n) => n.kind !== 'run')
    .sort((a, b) => compareNano(a.startTimeUnixNano, b.startTimeUnixNano));
}
