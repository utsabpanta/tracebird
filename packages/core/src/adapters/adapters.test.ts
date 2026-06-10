import { describe, expect, it } from 'vitest';
import { openinferenceAgent, vercelAiSdk, claudeCodeSession } from '@tracebird/fixtures';
import { buildRun } from '../build.js';
import { parseOtlp } from '../otlp/parse.js';
import { detectDialect, normalizeSpan } from './index.js';
import type { AgentNode, LlmCall, StepNode, ToolCall, TraceNode } from '../types.js';

function findKind(node: TraceNode, kind: TraceNode['kind']): TraceNode | undefined {
  if (node.kind === kind) return node;
  for (const child of node.children) {
    const found = findKind(child, kind);
    if (found) return found;
  }
  return undefined;
}

describe('detectDialect', () => {
  it('identifies each dialect from its spans', () => {
    expect(detectDialect(parseOtlp(openinferenceAgent)[1])).toBe('openinference');
    expect(detectDialect(parseOtlp(vercelAiSdk)[0])).toBe('vercel-ai-sdk');
    expect(detectDialect(parseOtlp(claudeCodeSession)[0])).toBe('claude-code');
  });

  it('leaves native gen_ai spans as "genai"', () => {
    const span = parseOtlp(openinferenceAgent)[1];
    const native = { ...span, name: 'chat', attributes: { 'gen_ai.operation.name': 'chat' } };
    expect(detectDialect(native)).toBe('genai');
  });
});

describe('normalizeSpan never clobbers explicit values', () => {
  it('keeps an existing gen_ai.* attribute over the adapter guess', () => {
    const [, llm] = parseOtlp(openinferenceAgent);
    const withExplicit = {
      ...llm,
      attributes: { ...llm.attributes, 'gen_ai.request.model': 'override-model' },
    };
    expect(normalizeSpan(withExplicit).attributes['gen_ai.request.model']).toBe('override-model');
  });
});

describe('OpenInference', () => {
  const run = buildRun(parseOtlp(openinferenceAgent));

  it('reconstructs agent → llm + tool with model, tokens, messages', () => {
    const agent = findKind(run.root, 'agent') as AgentNode;
    expect(agent).toBeDefined();
    const llm = findKind(run.root, 'llm') as LlmCall;
    expect(llm.model).toBe('gpt-4o');
    expect(llm.provider).toBe('openai');
    expect(llm.usage).toEqual({ input: 42, output: 18, total: 60 });
    expect(llm.prompt?.map((m) => m.role)).toEqual(['system', 'user']);
    expect(llm.completion?.[0].toolCalls?.[0].name).toBe('search_docs');
    expect(llm.costUsd).toBeGreaterThan(0);
  });

  it('maps the tool span with parsed args/result', () => {
    const tool = findKind(run.root, 'tool') as ToolCall;
    expect(tool.toolName).toBe('search_docs');
    expect(tool.arguments).toEqual({ query: 'enable telemetry' });
    expect(tool.result).toMatchObject({ hits: expect.any(Array) });
  });
});

describe('Vercel AI SDK', () => {
  const run = buildRun(parseOtlp(vercelAiSdk));

  it('treats the wrapper as a step and the inner call as the LLM (no double count)', () => {
    const step = run.root.children[0] as StepNode;
    expect(step.kind).toBe('step');
    const llm = findKind(run.root, 'llm') as LlmCall;
    expect(llm.model).toBe('gpt-4o');
    expect(llm.provider).toBe('openai');
    expect(llm.usage).toEqual({ input: 64, output: 30, total: 94 });
    // tokens roll up once, not twice
    expect(run.tokens.total).toBe(94);
    expect(llm.prompt?.[0].content).toContain('San Francisco');
    expect(llm.completion?.[0].content).toContain('check the current conditions');
  });

  it('maps the tool call', () => {
    const tool = findKind(run.root, 'tool') as ToolCall;
    expect(tool.toolName).toBe('getWeather');
    expect(tool.arguments).toEqual({ city: 'San Francisco' });
    expect(tool.result).toEqual({ tempC: 17, condition: 'foggy' });
  });
});

describe('Claude Code', () => {
  const run = buildRun(parseOtlp(claudeCodeSession));

  it('reconstructs interaction → llm_request + tool with bare token names', () => {
    const agent = findKind(run.root, 'agent') as AgentNode;
    expect(agent.agentName).toBe('claude-code');
    const llm = findKind(run.root, 'llm') as LlmCall;
    expect(llm.model).toBe('claude-sonnet-4');
    expect(llm.provider).toBe('anthropic');
    expect(llm.usage).toEqual({ input: 1840, output: 420, total: 2260 });
    expect(llm.costUsd).toBeGreaterThan(0); // claude-sonnet-4 is in the price table
    const tool = findKind(run.root, 'tool') as ToolCall;
    expect(tool.toolName).toBe('Edit');
  });

  it('derives a summary from the interaction prompt', () => {
    expect(run.summary).toContain('--json flag');
  });
});
