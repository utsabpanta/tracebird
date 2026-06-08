import { describe, expect, it } from 'vitest';
import { diffPairA, diffPairB, weatherHappyPath } from '@tracebird/fixtures';
import { buildRun } from './build.js';
import { parseOtlp } from './otlp/parse.js';
import { diffCalls, diffRuns, diffText } from './diff.js';
import type { AgentNode, LlmCall, NodeDiff } from './types.js';

const runA = buildRun(parseOtlp(diffPairA));
const runB = buildRun(parseOtlp(diffPairB));
const weather = buildRun(parseOtlp(weatherHappyPath));

function llmOf(run: ReturnType<typeof buildRun>): LlmCall {
  const agent = run.root.children[0] as AgentNode;
  return agent.children.find((c) => c.kind === 'llm') as LlmCall;
}

describe('diffText', () => {
  it('produces inline word-level segments', () => {
    const segs = diffText('Priority: P1. Escalate now', 'Priority: P2. Escalate now');
    expect(segs.some((s) => s.type === 'remove' && s.value.includes('P1'))).toBe(true);
    expect(segs.some((s) => s.type === 'add' && s.value.includes('P2'))).toBe(true);
    expect(
      segs
        .filter((s) => s.type === 'equal')
        .map((s) => s.value)
        .join(''),
    ).toContain('Escalate now');
  });

  it('is all-equal for identical text', () => {
    const segs = diffText('same text', 'same text');
    expect(segs.every((s) => s.type === 'equal')).toBe(true);
  });
});

describe('diffRuns — the "worked yesterday" pair', () => {
  const diff = diffRuns(runA, runB);

  it('flags the run as changed with model/cost field changes', () => {
    expect(diff.changed).toBe(true);
    const llmDiff = findChanged(diff.root);
    expect(llmDiff).toBeDefined();
    const modelChange = llmDiff?.fields.find((f) => f.field === 'model');
    expect(modelChange).toEqual({ field: 'model', a: 'gpt-4o', b: 'gpt-4o-mini' });
  });

  it('captures the completion text divergence (P1 → P2)', () => {
    const llmDiff = findChanged(diff.root);
    const completion = llmDiff?.texts.find((t) => t.label === 'completion');
    expect(completion?.changed).toBe(true);
    expect(completion?.segments.some((s) => s.type === 'remove' && s.value.includes('P1'))).toBe(
      true,
    );
    expect(completion?.segments.some((s) => s.type === 'add' && s.value.includes('P2'))).toBe(true);
  });

  it('reports a run with itself as unchanged', () => {
    const same = diffRuns(runA, runA);
    expect(same.changed).toBe(false);
    expect(same.root.status).toBe('unchanged');
  });
});

describe('diffRuns — structural add/remove', () => {
  it('marks extra children as added/removed via LCS alignment', () => {
    // weather has 4 children under the agent; diffPairA has 1. Aligning them
    // should surface added/removed tool & llm nodes.
    const diff = diffRuns(runA, weather);
    expect(diff.changed).toBe(true);
    const statuses = collectStatuses(diff.root);
    expect(statuses.has('added')).toBe(true);
  });
});

describe('diffCalls', () => {
  it('diffs two LLM calls field-wise and text-wise', () => {
    const diff = diffCalls(llmOf(runA), llmOf(runB));
    expect(diff.changed).toBe(true);
    expect(diff.fields.find((f) => f.field === 'model')?.b).toBe('gpt-4o-mini');
    expect(diff.completion.changed).toBe(true);
    expect(diff.prompt.changed).toBe(false); // same ticket prompt
  });
});

function findChanged(node: NodeDiff): NodeDiff | undefined {
  if (node.kind === 'llm' && node.status === 'changed') return node;
  for (const child of node.children) {
    const found = findChanged(child);
    if (found) return found;
  }
  return undefined;
}

function collectStatuses(node: NodeDiff, acc = new Set<string>()): Set<string> {
  acc.add(node.status);
  for (const child of node.children) collectStatuses(child, acc);
  return acc;
}
