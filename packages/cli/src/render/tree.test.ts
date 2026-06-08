import { describe, expect, it } from 'vitest';
import { buildRun, parseOtlp } from '@tracebird/core';
import { weatherHappyPath, toolError } from '@tracebird/fixtures';
import { renderRunTree } from './tree.js';

describe('renderRunTree', () => {
  it('renders the run summary header and a nested tree', () => {
    const out = renderRunTree(buildRun(parseOtlp(weatherHappyPath)));
    const lines = out.split('\n');

    expect(lines[0]).toContain('weather-assistant');
    expect(lines[0]).toContain('274 tok');
    expect(out).toContain('invoke_agent weather-assistant');
    expect(out).toContain('chat gpt-4o');
    expect(out).toContain('get_weather');
    // tree connectors present
    expect(out).toMatch(/[├└]─ /);
    // llm line shows model + cost
    expect(out).toContain('gpt-4o');
    expect(out).toMatch(/\$0\.000/);
  });

  it('flags errors in the tree', () => {
    const out = renderRunTree(buildRun(parseOtlp(toolError)));
    expect(out).toContain('ERROR');
  });
});
