import { describe, expect, it } from 'vitest';
import { classifyKind, extractMessages, extractUsage } from './genai.js';
import { SpanKind, StatusCode, type Span } from './types.js';

function span(partial: Partial<Span>): Span {
  return {
    traceId: 't',
    spanId: 's',
    name: 'span',
    kind: SpanKind.Internal,
    startTimeUnixNano: '0',
    endTimeUnixNano: '1',
    attributes: {},
    events: [],
    status: { code: StatusCode.Unset },
    resourceAttributes: {},
    ...partial,
  };
}

describe('classifyKind', () => {
  it('maps gen_ai.operation.name to node kinds', () => {
    expect(classifyKind(span({ attributes: { 'gen_ai.operation.name': 'chat' } }))).toBe('llm');
    expect(classifyKind(span({ attributes: { 'gen_ai.operation.name': 'execute_tool' } }))).toBe(
      'tool',
    );
    expect(classifyKind(span({ attributes: { 'gen_ai.operation.name': 'invoke_agent' } }))).toBe(
      'agent',
    );
    expect(classifyKind(span({ attributes: { 'gen_ai.operation.name': 'embeddings' } }))).toBe(
      'llm',
    );
  });

  it('keeps unknown operations as generic steps', () => {
    expect(classifyKind(span({ attributes: { 'gen_ai.operation.name': 'reflect' } }))).toBe('step');
  });

  it('infers kind from other signals when operation is absent', () => {
    expect(classifyKind(span({ attributes: { 'gen_ai.request.model': 'gpt-4o' } }))).toBe('llm');
    expect(classifyKind(span({ attributes: { 'gen_ai.tool.name': 'search' } }))).toBe('tool');
    expect(classifyKind(span({ name: 'chat anthropic' }))).toBe('llm');
    expect(classifyKind(span({ name: 'mystery' }))).toBe('step');
  });
});

describe('extractUsage', () => {
  it('reads modern and legacy token attribute names', () => {
    expect(
      extractUsage(
        span({
          attributes: { 'gen_ai.usage.input_tokens': 10, 'gen_ai.usage.output_tokens': 5 },
        }),
      ),
    ).toEqual({ input: 10, output: 5, total: 15 });
    expect(
      extractUsage(
        span({
          attributes: {
            'gen_ai.usage.prompt_tokens': 7,
            'gen_ai.usage.completion_tokens': 3,
            'gen_ai.usage.total_tokens': 10,
          },
        }),
      ),
    ).toEqual({ input: 7, output: 3, total: 10 });
  });
});

describe('extractMessages — content capture styles', () => {
  it('reads indexed buffered attributes', () => {
    const msgs = extractMessages(
      span({
        attributes: {
          'gen_ai.prompt.0.role': 'user',
          'gen_ai.prompt.0.content': 'hello',
        },
      }),
      'prompt',
    );
    expect(msgs).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('reads JSON gen_ai.input.messages / output.messages', () => {
    const msgs = extractMessages(
      span({
        attributes: {
          'gen_ai.input.messages': JSON.stringify([
            { role: 'system', content: 'be brief' },
            { role: 'user', content: 'hi' },
          ]),
        },
      }),
      'prompt',
    );
    expect(msgs?.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('reads event-based content capture', () => {
    const s = span({
      events: [
        { name: 'gen_ai.user.message', timeUnixNano: '0', attributes: { content: 'question?' } },
        {
          name: 'gen_ai.choice',
          timeUnixNano: '1',
          attributes: { content: 'answer.', role: 'assistant' },
        },
      ],
    });
    expect(extractMessages(s, 'prompt')).toEqual([{ role: 'user', content: 'question?' }]);
    expect(extractMessages(s, 'completion')).toEqual([{ role: 'assistant', content: 'answer.' }]);
  });

  it('returns undefined when no content is present', () => {
    expect(extractMessages(span({}), 'prompt')).toBeUndefined();
  });
});
