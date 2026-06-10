import { describe, expect, it } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SseHub } from './sse.js';

function mockClient() {
  const writes: string[] = [];
  let closed = false;
  let onClose = () => {
    closed = true;
  };
  const req = {
    on: (event: string, cb: () => void) => {
      if (event === 'close') onClose = cb;
    },
  } as unknown as IncomingMessage;
  const res = {
    writeHead: () => res,
    write: (chunk: string) => {
      writes.push(chunk);
      return true;
    },
    end: () => {
      closed = true;
    },
  } as unknown as ServerResponse;
  return { req, res, writes, isClosed: () => closed, close: () => onClose() };
}

describe('SseHub', () => {
  it('registers clients and broadcasts named JSON events to all of them', () => {
    const hub = new SseHub();
    const a = mockClient();
    const b = mockClient();
    hub.handle(a.req, a.res);
    hub.handle(b.req, b.res);
    expect(hub.size).toBe(2);

    hub.broadcast('run', { id: 'run:1' });
    const expected = 'event: run\ndata: {"id":"run:1"}\n\n';
    expect(a.writes).toContain(expected);
    expect(b.writes).toContain(expected);

    hub.close();
  });

  it('drops a client when its connection closes', () => {
    const hub = new SseHub();
    const c = mockClient();
    hub.handle(c.req, c.res);
    expect(hub.size).toBe(1);
    c.close();
    expect(hub.size).toBe(0);
    hub.close();
  });
});
