import type { ChatMessage, LlmCall, Run, ToolCall, TraceNode } from './types.js';

/** Deep, case-insensitive search over a run — summary, models, prompts,
 * completions, tool names and tool I/O — so "find the run where it said X" works. */

function stringify(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function messageText(messages: ChatMessage[] | undefined): string {
  if (!messages) return '';
  return messages
    .map((m) => {
      const calls = (m.toolCalls ?? [])
        .map((t) => `${t.name ?? ''} ${stringify(t.arguments)}`)
        .join(' ');
      return `${m.role} ${m.content} ${calls}`;
    })
    .join(' ');
}

function nodeText(node: TraceNode): string {
  let text = node.name;
  if (node.kind === 'llm') {
    const llm = node as LlmCall;
    text += ` ${llm.model ?? ''} ${messageText(llm.prompt)} ${messageText(llm.completion)}`;
  } else if (node.kind === 'tool') {
    const tool = node as ToolCall;
    text += ` ${tool.toolName ?? ''} ${stringify(tool.arguments)} ${stringify(tool.result)}`;
  }
  return text;
}

function collectText(node: TraceNode, acc: string[]): void {
  acc.push(nodeText(node));
  for (const child of node.children) collectText(child, acc);
}

/** Build the searchable text blob for a run (cached-friendly; pure). */
export function runSearchText(run: Run): string {
  const acc: string[] = [run.summary, run.service ?? ''];
  collectText(run.root, acc);
  return acc.join(' ').toLowerCase();
}

/** True if every whitespace-separated term in `query` appears somewhere in the run. */
export function runMatches(run: Run, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = runSearchText(run);
  return terms.every((term) => hay.includes(term));
}
