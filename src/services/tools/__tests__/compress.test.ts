import { extrapolateSize, samplePageIndices } from '../compressService';

jest.mock('@/native/pdfRenderer', () => ({ getPdfRenderer: () => null }));
jest.mock('@/services/library/documentService', () => ({}));
jest.mock('@/services/storage/fileStore', () => ({}));
jest.mock('@/services/storage/paths', () => ({}));

describe('compression estimates', () => {
  it('samples pages spread across the document', () => {
    expect(samplePageIndices(2)).toEqual([0, 1]);
    expect(samplePageIndices(10)).toEqual([0, 5, 9]);
    expect(samplePageIndices(100)).toEqual([0, 50, 99]);
  });

  it('extrapolates from the sample average plus overhead', () => {
    expect(extrapolateSize([100_000, 200_000], 10)).toBe(Math.round((150_000 + 600) * 10 + 1024));
    expect(extrapolateSize([], 5)).toBe(0);
  });
});
