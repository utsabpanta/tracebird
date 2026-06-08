import { StatusCode, type LlmCall, type Run, type ToolCall, type TraceNode } from '@tracebird/core';
import { formatCost, formatDuration, formatTokens } from './format.js';

/** Render a reconstructed {@link Run} as an indented tree for the terminal. */

const ICON: Record<TraceNode['kind'], string> = {
  run: '⏺',
  agent: '◆',
  llm: '✦',
  tool: '⚙',
  step: '▫',
};

function metrics(node: TraceNode): string {
  const parts: string[] = [formatDuration(node.durationMs)];
  if (node.kind === 'llm') {
    const llm = node as LlmCall;
    const tok = formatTokens(llm.usage.total ?? llm.usage.input);
    if (tok) parts.push(tok);
    const cost = formatCost(llm.costUsd);
    if (cost) parts.push(cost);
    if (llm.model) parts.push(llm.model);
  }
  if (node.kind === 'tool' && (node as ToolCall).isError) parts.push('ERROR');
  return parts.join('  ');
}

function label(node: TraceNode): string {
  return `${ICON[node.kind]} ${node.name}   ${metrics(node)}`;
}

function renderChildren(nodes: TraceNode[], prefix: string, lines: string[]): void {
  nodes.forEach((node, i) => {
    const last = i === nodes.length - 1;
    lines.push(`${prefix}${last ? '└─ ' : '├─ '}${label(node)}`);
    renderChildren(node.children, prefix + (last ? '   ' : '│  '), lines);
  });
}

export function renderRunTree(run: Run): string {
  const header: string[] = [run.summary, formatDuration(run.durationMs)];
  const tok = formatTokens(run.tokens.total);
  if (tok) header.push(tok);
  const cost = formatCost(run.costUsd);
  if (cost) header.push(cost);
  if (run.status.code === StatusCode.Error) header.push('ERROR');

  const lines: string[] = [header.join('  ·  ')];
  renderChildren(run.root.children, '', lines);
  return lines.join('\n');
}
