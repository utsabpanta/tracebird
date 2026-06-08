import { describe, expect, it } from 'vitest';
import { parseOtlp } from '@tracebird/core';
import { weatherHappyPath, toolError } from '@tracebird/fixtures';
import { TraceBuffer } from './trace-buffer.js';

const weather = parseOtlp(weatherHappyPath);
const errs = parseOtlp(toolError);

describe('TraceBuffer', () => {
  it('flushes a trace explicitly with all its spans', () => {
    const flushed: { traceId: string; count: number }[] = [];
    const buf = new TraceBuffer({ onComplete: (id, spans) => flushed.push({ traceId: id, count: spans.length }) });

    // deliver the weather trace in two separate batches
    buf.add(weather.slice(0, 2));
    buf.add(weather.slice(2));
    expect(buf.pending).toBe(1);

    buf.flushAll();
    expect(flushed).toEqual([{ traceId: weather[0].traceId, count: 5 }]);
    expect(buf.pending).toBe(0);
  });

  it('keeps distinct traces separate', () => {
    const flushed = new Map<string, number>();
    const buf = new TraceBuffer({ onComplete: (id, spans) => flushed.set(id, spans.length) });
    buf.add([...weather, ...errs]);
    expect(buf.pending).toBe(2);
    buf.flushAll();
    expect(flushed.get(weather[0].traceId)).toBe(5);
    expect(flushed.get(errs[0].traceId)).toBe(4);
  });

  it('auto-flushes after the idle timeout', async () => {
    const flushed: string[] = [];
    const buf = new TraceBuffer({ idleMs: 20, onComplete: (id) => flushed.push(id) });
    buf.add(weather);
    expect(flushed).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(flushed).toEqual([weather[0].traceId]);
    expect(buf.pending).toBe(0);
  });
});
