import { findMatches, joinPages } from '../ocrService';

jest.mock('@/native/ocr', () => ({ getOcrProvider: () => null }));
jest.mock('@/native/pdfRenderer', () => ({ getPdfRenderer: () => null }));
jest.mock('@/db/textRepository', () => ({}));
jest.mock('@/services/library/documentService', () => ({}));
jest.mock('@/services/storage/fileStore', () => ({}));
jest.mock('@/services/storage/paths', () => ({}));

describe('OCR helpers', () => {
  const pages = [{ text: 'Total 100\nTOTAL due' }, { text: 'nothing here' }, { text: 'total total' }];

  it('counts matches per page, case-insensitively', () => {
    expect(findMatches(pages, 'total')).toEqual([2, 0, 2]);
    expect(findMatches(pages, '  ')).toEqual([0, 0, 0]);
  });

  it('joins pages with headers only for multi-page results', () => {
    expect(joinPages([{ text: 'a' }])).toBe('a');
    expect(joinPages([{ text: 'a' }, { text: 'b' }])).toBe('--- Page 1 ---\na\n\n--- Page 2 ---\nb');
  });
});
