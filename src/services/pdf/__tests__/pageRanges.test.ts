import { formatPageRanges, parsePageRanges } from '../pageRanges';

describe('parsePageRanges', () => {
  it('parses single pages, ranges and open ranges', () => {
    expect(parsePageRanges('1, 3-4, 9-', 10)).toEqual([0, 2, 3, 8, 9]);
    expect(parsePageRanges('-2', 5)).toEqual([0, 1]);
  });

  it('deduplicates while preserving first occurrence order', () => {
    expect(parsePageRanges('3, 1-3', 5)).toEqual([2, 0, 1]);
  });

  it('rejects invalid input', () => {
    expect(() => parsePageRanges('', 3)).toThrow();
    expect(() => parsePageRanges('abc', 3)).toThrow('not a valid');
    expect(() => parsePageRanges('4', 3)).toThrow('outside');
    expect(() => parsePageRanges('3-1', 3)).toThrow('starts after');
    expect(() => parsePageRanges('0', 3)).toThrow('outside');
  });
});

describe('formatPageRanges', () => {
  it('compacts indices', () => {
    expect(formatPageRanges([0, 1, 2, 4, 6, 7])).toBe('1-3, 5, 7-8');
    expect(formatPageRanges([])).toBe('');
  });
});
