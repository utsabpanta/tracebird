import { describe, expect, it } from 'vitest';
import { weatherHappyPath, toolError } from '@tracebird/fixtures';
import { buildRun } from './build.js';
import { parseOtlp } from './otlp/parse.js';
import {
  parseRun,
  parseSession,
  RunParseError,
  serializeRun,
  serializeSession,
} from './serialize.js';

const run = buildRun(parseOtlp(weatherHappyPath));
const run2 = buildRun(parseOtlp(toolError));

describe('serializeRun / parseRun', () => {
  it('round-trips a run losslessly on one line', () => {
    const line = serializeRun(run);
    expect(line).not.toContain('\n');
    expect(parseRun(line)).toEqual(run);
  });

  it('rejects invalid JSON and non-run records', () => {
    expect(() => parseRun('{not json')).toThrow(RunParseError);
    expect(() => parseRun('{"hello":"world"}')).toThrow(RunParseError);
  });

  it('rejects sessions from a newer schema version', () => {
    const future = JSON.stringify({ ...run, schemaVersion: 999 });
    expect(() => parseRun(future)).toThrow(/newer than supported/);
  });
});

describe('serializeSession / parseSession', () => {
  it('round-trips multiple runs', () => {
    const doc = serializeSession([run, run2]);
    const parsed = parseSession(doc);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].traceId).toBe(run.traceId);
    expect(parsed[1].traceId).toBe(run2.traceId);
  });

  it('skips blank and malformed lines, reporting errors', () => {
    const errors: RunParseError[] = [];
    const doc = `${serializeRun(run)}\n\n{garbage}\n${serializeRun(run2)}\n`;
    const parsed = parseSession(doc, (e) => errors.push(e));
    expect(parsed).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(3);
  });

  it('serializes an empty session as an empty string', () => {
    expect(serializeSession([])).toBe('');
    expect(parseSession('')).toEqual([]);
  });
});
