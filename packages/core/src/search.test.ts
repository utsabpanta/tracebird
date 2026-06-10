import { describe, expect, it } from 'vitest';
import { weatherHappyPath, toolError } from '@tracebird/fixtures';
import { buildRun } from './build.js';
import { parseOtlp } from './otlp/parse.js';
import { runMatches } from './search.js';

const weather = buildRun(parseOtlp(weatherHappyPath));
const error = buildRun(parseOtlp(toolError));

describe('runMatches', () => {
  it('matches text in the summary', () => {
    expect(runMatches(weather, 'paris')).toBe(true);
    expect(runMatches(weather, 'atlantis')).toBe(false);
  });

  it('matches deep content — prompts, completions, tool results', () => {
    expect(runMatches(weather, 'umbrella')).toBe(true); // final completion text
    expect(runMatches(weather, 'get_forecast')).toBe(true); // tool name
    expect(runMatches(weather, 'sunny')).toBe(true); // tool result
  });

  it('matches the model name', () => {
    expect(runMatches(weather, 'gpt-4o')).toBe(true);
  });

  it('requires all terms (AND semantics) and is case-insensitive', () => {
    expect(runMatches(weather, 'Paris WEATHER')).toBe(true);
    expect(runMatches(weather, 'paris atlantis')).toBe(false);
  });

  it('matches the error message in a failed run', () => {
    expect(runMatches(error, 'no such location')).toBe(true);
  });

  it('an empty query matches everything', () => {
    expect(runMatches(weather, '')).toBe(true);
    expect(runMatches(weather, '   ')).toBe(true);
  });
});
