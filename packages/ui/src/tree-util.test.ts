import { describe, expect, it } from 'vitest';
import { buildRun, parseOtlp } from '@tracebird/core';
import { weatherHappyPath } from '@tracebird/fixtures';
import { flattenByTime, flattenInOrder } from './tree-util.js';

const run = buildRun(parseOtlp(weatherHappyPath));

describe('tree-util', () => {
  it('flattenInOrder includes the root and every node', () => {
    const all = flattenInOrder(run.root);
    // run + agent + 4 children
    expect(all).toHaveLength(6);
    expect(all[0].kind).toBe('run');
  });

  it('flattenByTime drops the run root and sorts by start time', () => {
    const timeline = flattenByTime(run.root);
    expect(timeline.every((n) => n.kind !== 'run')).toBe(true);
    const starts = timeline.map((n) => Number(n.startTimeUnixNano));
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);
    // first event is the planning LLM call
    expect(timeline[0].kind).toBe('agent');
  });
});
