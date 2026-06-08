import { describe, expect, it } from 'vitest';
import { weatherHappyPath, toolError } from '@tracebird/fixtures';
import { buildRun, buildRuns } from './build.js';
import { parseOtlp } from './otlp/parse.js';
import { StatusCode, type AgentNode, type LlmCall, type ToolCall } from './types.js';

const weatherSpans = parseOtlp(weatherHappyPath);

describe('buildRun — weather happy path', () => {
  const run = buildRun(weatherSpans);

  it('wraps the trace in a synthetic run node', () => {
    expect(run.root.kind).toBe('run');
    expect(run.schemaVersion).toBe(1);
    expect(run.service).toBe('weather-assistant');
    expect(run.status.code).toBe(StatusCode.Ok);
    expect(run.root.children).toHaveLength(1);
  });

  it('reconstructs the agent → (llm, tool, tool, llm) hierarchy in time order', () => {
    const agent = run.root.children[0] as AgentNode;
    expect(agent.kind).toBe('agent');
    expect(agent.agentName).toBe('weather-assistant');
    expect(agent.children.map((c) => c.kind)).toEqual(['llm', 'tool', 'tool', 'llm']);
    expect(agent.children.map((c) => c.name)).toEqual([
      'chat gpt-4o',
      'execute_tool get_weather',
      'execute_tool get_forecast',
      'chat gpt-4o',
    ]);
  });

  it('extracts model, usage, messages and cost for an LLM call', () => {
    const agent = run.root.children[0] as AgentNode;
    const llm = agent.children[0] as LlmCall;
    expect(llm.model).toBe('gpt-4o');
    expect(llm.provider).toBe('openai');
    expect(llm.usage).toEqual({ input: 58, output: 34, total: 92 });
    expect(llm.prompt?.map((m) => m.role)).toEqual(['system', 'user']);
    expect(llm.prompt?.[1].content).toBe('What should I wear in Paris today?');
    // completion carries the two parallel tool calls
    expect(llm.completion?.[0].toolCalls?.map((t) => t.name)).toEqual([
      'get_weather',
      'get_forecast',
    ]);
    expect(llm.completion?.[0].toolCalls?.[0].arguments).toEqual({ location: 'Paris' });
    // 58/1e6*2.5 + 34/1e6*10
    expect(llm.costUsd).toBeCloseTo(0.000485, 9);
  });

  it('extracts tool name, parsed args/result and error state', () => {
    const agent = run.root.children[0] as AgentNode;
    const tool = agent.children[1] as ToolCall;
    expect(tool.kind).toBe('tool');
    expect(tool.toolName).toBe('get_weather');
    expect(tool.arguments).toEqual({ location: 'Paris' });
    expect(tool.result).toEqual({ tempC: 18, condition: 'sunny', humidity: 0.41 });
    expect(tool.isError).toBe(false);
  });

  it('rolls up tokens and cost across the run', () => {
    expect(run.tokens).toEqual({ input: 198, output: 76, total: 274 });
    expect(run.costUsd).toBeCloseTo(0.001255, 9);
  });

  it('derives a human summary from agent name + first user prompt', () => {
    expect(run.summary).toContain('weather-assistant');
    expect(run.summary).toContain('What should I wear');
  });
});

describe('buildRun — error propagation', () => {
  it('marks the run and tool node as errored', () => {
    const run = buildRun(parseOtlp(toolError));
    expect(run.status.code).toBe(StatusCode.Error);
    const agent = run.root.children[0] as AgentNode;
    const tool = agent.children.find((c) => c.kind === 'tool') as ToolCall;
    expect(tool.isError).toBe(true);
    expect(tool.result).toEqual({ error: 'no such location "Atlantis"' });
  });
});

describe('buildRun — defensiveness', () => {
  it('is insensitive to span arrival order', () => {
    const shuffled = [...weatherSpans].reverse();
    const a = buildRun(weatherSpans);
    const b = buildRun(shuffled);
    expect(JSON.stringify(b.root)).toBe(JSON.stringify(a.root));
  });

  it('attaches orphan spans (missing parent) under the synthetic root', () => {
    const orphans = weatherSpans.map((s) =>
      s.parentSpanId ? { ...s, parentSpanId: 'deadbeefdeadbeef' } : s,
    );
    const run = buildRun(orphans);
    // root span + 4 now-orphaned spans all become top-level children
    expect(run.root.children).toHaveLength(5);
  });

  it('degrades an unknown operation to a generic step node', () => {
    const [first] = weatherSpans;
    const weird = {
      ...first,
      parentSpanId: undefined,
      attributes: { 'gen_ai.operation.name': 'summarize_memory' },
    };
    const run = buildRun([weird]);
    expect(run.root.children[0].kind).toBe('step');
  });

  it('handles an empty span list without throwing', () => {
    const run = buildRun([]);
    expect(run.root.children).toHaveLength(0);
    expect(run.tokens).toEqual({});
    expect(run.costUsd).toBeNull();
  });
});

describe('buildRuns', () => {
  it('groups spans by trace id into separate runs', () => {
    const mixed = [...parseOtlp(weatherHappyPath), ...parseOtlp(toolError)];
    const runs = buildRuns(mixed);
    expect(runs).toHaveLength(2);
    expect(new Set(runs.map((r) => r.traceId)).size).toBe(2);
  });
});
