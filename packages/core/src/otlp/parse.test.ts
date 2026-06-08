import { describe, expect, it } from 'vitest';
import { weatherHappyPath, toolError } from '@tracebird/fixtures';
import { parseOtlp, anyValueToJs, keyValuesToAttributes } from './parse.js';
import { SpanKind, StatusCode } from '../types.js';
import type { ExportTraceServiceRequest } from './wire.js';

describe('anyValueToJs', () => {
  it('unwraps each AnyValue variant', () => {
    expect(anyValueToJs({ stringValue: 'hi' })).toBe('hi');
    expect(anyValueToJs({ boolValue: true })).toBe(true);
    expect(anyValueToJs({ intValue: '42' })).toBe(42);
    expect(anyValueToJs({ intValue: 7 })).toBe(7);
    expect(anyValueToJs({ doubleValue: 0.5 })).toBe(0.5);
    expect(
      anyValueToJs({ arrayValue: { values: [{ stringValue: 'a' }, { intValue: '2' }] } }),
    ).toEqual(['a', 2]);
    expect(
      anyValueToJs({ kvlistValue: { values: [{ key: 'k', value: { stringValue: 'v' } }] } }),
    ).toEqual({ k: 'v' });
    expect(anyValueToJs(undefined)).toBeNull();
  });
});

describe('keyValuesToAttributes', () => {
  it('flattens a KeyValue list and skips malformed entries', () => {
    const attrs = keyValuesToAttributes([
      { key: 'a', value: { stringValue: 'x' } },
      // @ts-expect-error intentionally malformed
      { value: { stringValue: 'no key' } },
    ]);
    expect(attrs).toEqual({ a: 'x' });
  });
});

describe('parseOtlp', () => {
  it('flattens the weather fixture into normalized spans', () => {
    const spans = parseOtlp(weatherHappyPath);
    expect(spans).toHaveLength(5);

    const root = spans.find((s) => s.name.startsWith('invoke_agent'));
    expect(root).toBeDefined();
    expect(root?.parentSpanId).toBeUndefined();
    expect(root?.kind).toBe(SpanKind.Internal);
    expect(root?.status.code).toBe(StatusCode.Ok);
    // Resource + scope context is propagated onto every span.
    expect(root?.resourceAttributes['service.name']).toBe('weather-assistant');
    expect(root?.scope?.name).toBe('opentelemetry.instrumentation.openai');

    const llm = spans.find((s) => s.attributes['gen_ai.operation.name'] === 'chat');
    expect(llm?.attributes['gen_ai.request.model']).toBe('gpt-4o');
    expect(llm?.attributes['gen_ai.usage.input_tokens']).toBe(58);
    expect(llm?.attributes['gen_ai.request.temperature']).toBe(0.7);
  });

  it('carries through error status and message', () => {
    const spans = parseOtlp(toolError);
    const tool = spans.find((s) => s.name.startsWith('execute_tool'));
    expect(tool?.status.code).toBe(StatusCode.Error);
    expect(tool?.status.message).toContain('Atlantis');
  });

  it('supports the legacy instrumentationLibrarySpans field', () => {
    const legacy: ExportTraceServiceRequest = {
      resourceSpans: [
        {
          resource: { attributes: [{ key: 'service.name', value: { stringValue: 'legacy-svc' } }] },
          instrumentationLibrarySpans: [
            {
              instrumentationLibrary: { name: 'old.lib', version: '1.0.0' },
              spans: [
                {
                  traceId: 'aa',
                  spanId: 'bb',
                  name: 'legacy span',
                  startTimeUnixNano: '100',
                  endTimeUnixNano: '200',
                },
              ],
            },
          ],
        },
      ],
    };
    const spans = parseOtlp(legacy);
    expect(spans).toHaveLength(1);
    expect(spans[0].scope?.name).toBe('old.lib');
    expect(spans[0].resourceAttributes['service.name']).toBe('legacy-svc');
  });

  it('is defensive about missing/empty input', () => {
    expect(parseOtlp(undefined)).toEqual([]);
    expect(parseOtlp(null)).toEqual([]);
    expect(parseOtlp({})).toEqual([]);
    expect(parseOtlp({ resourceSpans: [] })).toEqual([]);
  });

  it('skips spans without a span id but keeps the rest', () => {
    const req: ExportTraceServiceRequest = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              scope: { name: 's' },
              spans: [
                { spanId: 'keep', name: 'ok', startTimeUnixNano: '1', endTimeUnixNano: '2' },
                { name: 'no id', startTimeUnixNano: '1', endTimeUnixNano: '2' },
              ],
            },
          ],
        },
      ],
    };
    const spans = parseOtlp(req);
    expect(spans).toHaveLength(1);
    expect(spans[0].spanId).toBe('keep');
  });

  it('defaults end time to start time when end is missing', () => {
    const req: ExportTraceServiceRequest = {
      resourceSpans: [
        { scopeSpans: [{ spans: [{ spanId: 'x', name: 'n', startTimeUnixNano: '500' }] }] },
      ],
    };
    const [span] = parseOtlp(req);
    expect(span.startTimeUnixNano).toBe('500');
    expect(span.endTimeUnixNano).toBe('500');
  });
});
