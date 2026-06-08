import { describe, expect, it } from 'vitest';
import { otlpFixtures } from './index.js';

describe('otlpFixtures', () => {
  it('every fixture is a well-formed ExportTraceServiceRequest', () => {
    for (const [name, req] of Object.entries(otlpFixtures)) {
      expect(req.resourceSpans, name).toBeDefined();
      const spans = req.resourceSpans.flatMap((rs) =>
        rs.scopeSpans.flatMap((ss) => ss.spans),
      );
      expect(spans.length, name).toBeGreaterThan(0);
      for (const s of spans) {
        expect(s.spanId, `${name} span id`).toMatch(/^[0-9a-f]+$/);
        expect(s.traceId, `${name} trace id`).toMatch(/^[0-9a-f]+$/);
      }
    }
  });
});
