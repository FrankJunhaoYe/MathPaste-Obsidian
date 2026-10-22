import { describe, expect, it, vi } from 'vitest';

vi.mock('mdast-util-from-markdown', () => ({
  fromMarkdown: vi.fn(() => {
    throw new Error('Synthetic parser failure');
  }),
}));

import { planConversion, planPaste } from '../src/converter';

describe('parser failure safety', () => {
  it('returns no edits instead of falling back to blind replacement', () => {
    expect(planConversion(String.raw`\(x\)`)).toEqual({
      status: 'unsafe-context',
      edits: [],
      convertedCount: 0,
    });
    expect(planPaste('plain text', { from: 0, to: 0 }, String.raw`\(x\)`)).toEqual({
      status: 'unsafe-context',
      edits: [],
      convertedCount: 0,
    });
  });
});
