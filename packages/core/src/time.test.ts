import { describe, expect, it } from 'vitest';
import { compareNano, durationMs, nanoToEpochMs } from './time.js';

describe('time helpers', () => {
  it('durationMs computes millisecond differences losslessly', () => {
    expect(durationMs('1000000000', '1500000000')).toBe(500);
    expect(durationMs('0', '1000000')).toBe(1);
    // sub-millisecond fraction
    expect(durationMs('0', '1500000')).toBeCloseTo(1.5, 6);
  });

  it('durationMs clamps negative/zero durations to 0', () => {
    expect(durationMs('2000', '1000')).toBe(0);
    expect(durationMs('1000', '1000')).toBe(0);
  });

  it('compareNano orders large 64-bit timestamps correctly', () => {
    // These exceed Number.MAX_SAFE_INTEGER; string/BigInt comparison is required.
    expect(compareNano('1733000000000000001', '1733000000000000002')).toBe(-1);
    expect(compareNano('1733000000000000002', '1733000000000000001')).toBe(1);
    expect(compareNano('1733000000000000001', '1733000000000000001')).toBe(0);
  });

  it('nanoToEpochMs converts to epoch millis', () => {
    expect(nanoToEpochMs('1733000000000000000')).toBe(1733000000000);
  });

  it('is defensive about non-numeric input', () => {
    expect(durationMs('abc', 'def')).toBe(0);
    expect(compareNano('x', 'y')).toBe(0);
  });
});
