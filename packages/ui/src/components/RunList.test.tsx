import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RunList } from './RunList.js';
import type { RunSummary } from '../api.js';

const runs: RunSummary[] = [
  {
    id: 'run:a',
    traceId: 'a',
    summary: 'weather assistant · what to wear',
    startTimeUnixNano: '2',
    durationMs: 1300,
    status: 'ok',
    tokens: { input: 198, output: 76, total: 274 },
    costUsd: 0.0013,
    nodeCount: 6,
  },
  {
    id: 'run:b',
    traceId: 'b',
    summary: 'triage · checkout 500',
    startTimeUnixNano: '1',
    durationMs: 410,
    status: 'error',
    tokens: { total: 144 },
    costUsd: null,
    nodeCount: 2,
  },
];

afterEach(cleanup);

describe('RunList', () => {
  it('renders runs with metrics and reports selection', () => {
    const onSelect = vi.fn();
    render(<RunList runs={runs} selectedId="run:a" onSelect={onSelect} />);

    expect(screen.getByText('weather assistant · what to wear')).toBeTruthy();
    expect(screen.getByText('274')).toBeTruthy();
    expect(screen.getByText('$0.0013')).toBeTruthy();

    fireEvent.click(screen.getByText('triage · checkout 500'));
    expect(onSelect).toHaveBeenCalledWith('run:b');
  });

  it('shows an empty message when there are no runs', () => {
    render(<RunList runs={[]} selectedId={undefined} onSelect={() => undefined} />);
    expect(screen.getByText(/no runs captured/i)).toBeTruthy();
  });
});
