import { describe, expect, it } from 'vitest';
import { formatCost, formatDuration, formatTokens } from './format.js';

describe('formatDuration', () => {
  it('formats sub-second, second, and minute ranges', () => {
    expect(formatDuration(820)).toBe('820ms');
    expect(formatDuration(1250)).toBe('1.25s');
    expect(formatDuration(64000)).toBe('1m 4s');
    expect(formatDuration(-1)).toBe('—');
  });
});

describe('formatTokens', () => {
  it('groups thousands and handles unknown', () => {
    expect(formatTokens(1234)).toBe('1,234');
    expect(formatTokens(undefined)).toBe('—');
  });
});

describe('formatCost', () => {
  it('formats small and large costs, and unknown', () => {
    expect(formatCost(null)).toBe('—');
    expect(formatCost(0)).toBe('$0');
    expect(formatCost(0.0023)).toBe('$0.0023');
    expect(formatCost(1.5)).toBe('$1.50');
  });
});
