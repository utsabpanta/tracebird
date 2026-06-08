import type { NodeKind } from '@tracebird/core';

export interface KindMeta {
  icon: string;
  label: string;
  /** CSS color variable used for the icon/accent. */
  color: string;
}

export const KIND_META: Record<NodeKind, KindMeta> = {
  run: { icon: '⏺', label: 'Run', color: 'var(--muted)' },
  agent: { icon: '◆', label: 'Agent', color: '#c792ea' },
  llm: { icon: '✦', label: 'LLM', color: '#6ea8fe' },
  tool: { icon: '⚙', label: 'Tool', color: '#5ec5a0' },
  step: { icon: '▫', label: 'Step', color: 'var(--muted)' },
};
