import { describe, expect, it } from 'vitest';
import { estimateCost, normalizeModel, DEFAULT_PRICES } from './cost.js';

describe('normalizeModel', () => {
  it('lowercases and strips date/latest suffixes', () => {
    expect(normalizeModel('GPT-4o')).toBe('gpt-4o');
    expect(normalizeModel('gpt-4o-2024-08-06')).toBe('gpt-4o');
    expect(normalizeModel('claude-3-5-sonnet-latest')).toBe('claude-3-5-sonnet');
  });
});

describe('estimateCost', () => {
  it('prices a known model by input/output tokens', () => {
    expect(estimateCost('gpt-4o', { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(12.5, 6);
  });

  it('matches dated and prefixed model ids', () => {
    expect(estimateCost('gpt-4o-2024-08-06', { input: 1_000_000, output: 0 })).toBeCloseTo(2.5, 6);
    expect(estimateCost('claude-3-5-sonnet-20241022', { input: 0, output: 1_000_000 })).toBeCloseTo(
      15,
      6,
    );
  });

  it('returns null for unknown models — never a guess', () => {
    expect(estimateCost('some-future-model-v9', { input: 100, output: 100 })).toBeNull();
    expect(estimateCost(undefined, { input: 100 })).toBeNull();
  });

  it('returns null when token counts are missing', () => {
    expect(estimateCost('gpt-4o', {})).toBeNull();
  });

  it('accepts a custom price table', () => {
    const prices = { 'my-model': { inputPerMTok: 1, outputPerMTok: 2 } };
    expect(estimateCost('my-model', { input: 1_000_000, output: 1_000_000 }, prices)).toBeCloseTo(
      3,
      6,
    );
    // default table no longer applies
    expect(estimateCost('gpt-4o', { input: 1_000_000 }, prices)).toBeNull();
  });

  it('default table is non-empty and well-formed', () => {
    for (const price of Object.values(DEFAULT_PRICES)) {
      expect(price.inputPerMTok).toBeGreaterThan(0);
      expect(price.outputPerMTok).toBeGreaterThan(0);
    }
  });
});
