import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { diffText } from '@tracebird/core';
import { TextDiffView } from './DiffView.js';

afterEach(cleanup);

describe('TextDiffView', () => {
  it('renders add/remove/equal segments with the right classes', () => {
    const segments = diffText('Priority P1 escalate', 'Priority P2 escalate');
    const { container } = render(<TextDiffView segments={segments} />);

    const removed = container.querySelector('.seg-remove');
    const added = container.querySelector('.seg-add');
    expect(removed?.textContent).toContain('P1');
    expect(added?.textContent).toContain('P2');
    expect(container.querySelector('.seg-equal')?.textContent).toContain('Priority');
  });
});
