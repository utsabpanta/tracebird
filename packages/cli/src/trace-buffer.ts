import type { Span } from '@tracebird/core';

export interface TraceBufferOptions {
  /** Flush a trace after this many ms with no new spans. Default 1500. */
  idleMs?: number;
  /** Called with all buffered spans for a trace once it goes idle. */
  onComplete: (traceId: string, spans: Span[]) => void;
}

/**
 * Buffers incoming spans per trace id and flushes a trace once it has been idle
 * for `idleMs`. OTLP gives us no explicit "trace complete" signal, so idle
 * detection is the pragmatic trigger; `flushAll` forces completion on shutdown.
 */
export class TraceBuffer {
  private readonly idleMs: number;
  private readonly onComplete: TraceBufferOptions['onComplete'];
  private readonly traces = new Map<string, { spans: Span[]; timer: NodeJS.Timeout }>();

  constructor(options: TraceBufferOptions) {
    this.idleMs = options.idleMs ?? 1500;
    this.onComplete = options.onComplete;
  }

  add(spans: Span[]): void {
    const grouped = new Map<string, Span[]>();
    for (const span of spans) {
      const list = grouped.get(span.traceId) ?? [];
      list.push(span);
      grouped.set(span.traceId, list);
    }
    for (const [traceId, group] of grouped) {
      const entry = this.traces.get(traceId);
      if (entry) {
        entry.spans.push(...group);
        clearTimeout(entry.timer);
        entry.timer = this.schedule(traceId);
      } else {
        this.traces.set(traceId, { spans: group, timer: this.schedule(traceId) });
      }
    }
  }

  private schedule(traceId: string): NodeJS.Timeout {
    const timer = setTimeout(() => this.flush(traceId), this.idleMs);
    // Don't keep the event loop alive solely for a pending flush.
    timer.unref?.();
    return timer;
  }

  /** Flush a single trace now, if buffered. */
  flush(traceId: string): void {
    const entry = this.traces.get(traceId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.traces.delete(traceId);
    this.onComplete(traceId, entry.spans);
  }

  /** Flush every buffered trace (e.g. on shutdown). */
  flushAll(): void {
    for (const traceId of [...this.traces.keys()]) this.flush(traceId);
  }

  get pending(): number {
    return this.traces.size;
  }
}
