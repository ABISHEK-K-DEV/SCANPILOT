import { formatBytes, formatPageCount } from '../format';
import { exportFileName, sanitizeDocumentName, timestampedName, uniqueName, validateName } from '../filename';

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
    expect(formatBytes(1.234 * 1024 * 1024 * 1024)).toBe('1.23 GB');
  });
});

describe('formatPageCount', () => {
  it('pluralises', () => {
    expect(formatPageCount(1)).toBe('1 page');
    expect(formatPageCount(3)).toBe('3 pages');
    expect(formatPageCount(null)).toBe('— pages');
  });
});

describe('file names', () => {
  it('sanitises names', () => {
    expect(sanitizeDocumentName('  a/b:c*?  ')).toBe('a b c');
    expect(sanitizeDocumentName('...hidden')).toBe('hidden');
    expect(sanitizeDocumentName('   ', 'Scan')).toBe('Scan');
    expect(sanitizeDocumentName('x'.repeat(200))).toHaveLength(120);
  });

  it('validates names', () => {
    expect(validateName('')).toMatch('empty');
    expect(validateName('a/b')).toMatch('cannot contain');
    expect(validateName('Invoice')).toBeNull();
  });

  it('builds export names and unique names', () => {
    expect(exportFileName('Tax: 2026')).toBe('Tax 2026.pdf');
    const taken = new Set(['Doc', 'Doc (2)']);
    expect(uniqueName('Doc', (n) => taken.has(n))).toBe('Doc (3)');
    expect(uniqueName('New', (n) => taken.has(n))).toBe('New');
    expect(timestampedName('Scan', new Date(2026, 0, 5, 9, 7))).toBe('Scan 2026-01-05 09.07');
  });
});
