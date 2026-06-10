import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * A tiny Server-Sent-Events hub. The UI subscribes once to `GET /api/stream`
 * and is pushed `activity` (spans arriving) and `run` (a run completed) events,
 * so it updates instantly instead of polling.
 */
export class SseHub {
  private readonly clients = new Set<ServerResponse>();
  private heartbeat?: ReturnType<typeof setInterval>;

  /** Register a long-lived SSE connection. */
  handle(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    this.clients.add(res);
    req.on('close', () => this.clients.delete(res));

    if (!this.heartbeat) {
      this.heartbeat = setInterval(() => this.write(':ping\n\n'), 15000);
      this.heartbeat.unref?.();
    }
  }

  /** Push a named event with a JSON payload to every connected client. */
  broadcast(event: string, data: unknown = {}): void {
    this.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private write(text: string): void {
    for (const res of this.clients) {
      try {
        res.write(text);
      } catch {
        this.clients.delete(res);
      }
    }
  }

  get size(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const res of this.clients) {
      try {
        res.end();
      } catch {
        /* client already gone */
      }
    }
    this.clients.clear();
  }
}
