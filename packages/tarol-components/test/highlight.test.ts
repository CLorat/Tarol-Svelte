import { describe, expect, it } from 'vitest';
import { highlight } from '../src/lib/highlight.js';

describe('highlight', () => {
  it('splits a snippet at its ranges in UTF-16 code units', () => {
    const text = '🌻 Irises by Vincent';
    expect(highlight(text, [{ start: 3, length: 6 }])).toEqual([
      { text: '🌻 ', mark: false },
      { text: 'Irises', mark: true },
      { text: ' by Vincent', mark: false },
    ]);
  });

  it('sorts, merges overlaps, cuts ranges to the text and drops empty ones', () => {
    expect(
      highlight('abcdefgh', [
        { start: 6, length: 10 },
        { start: 0, length: 2 },
        { start: 1, length: 2 },
        { start: 4, length: 0 },
        { start: -3, length: 1 },
      ]),
    ).toEqual([
      { text: 'abc', mark: true },
      { text: 'def', mark: false },
      { text: 'gh', mark: true },
    ]);
  });

  it('gives the whole text without highlights', () => {
    expect(highlight('plain')).toEqual([{ text: 'plain', mark: false }]);
    expect(highlight('')).toEqual([]);
  });
});
