/// <reference types="node" />
import { PDFDocument } from 'pdf-lib';

import { CancelledError, UserFacingError } from '@/utils/errors';

import {
  applyPagePlan,
  deletePages,
  detectImageType,
  duplicatePage,
  extractPages,
  getPdfInfo,
  imagesToPdf,
  isPdf,
  mergePdfs,
  reorderPages,
  rotatePages,
  splitIntoSinglePages,
  splitPdf,
} from '../pdfService';
import { JPEG_2X1, makePdf, PNG_1X1, pageRotations, pageWidths } from './fixtures';

describe('detection helpers', () => {
  it('detects JPEG and PNG by magic bytes', () => {
    expect(detectImageType(JPEG_2X1)).toBe('image/jpeg');
    expect(detectImageType(PNG_1X1)).toBe('image/png');
    expect(detectImageType(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it('recognises PDF headers', async () => {
    expect(isPdf(await makePdf(1))).toBe(true);
    expect(isPdf(PNG_1X1)).toBe(false);
  });
});

describe('getPdfInfo', () => {
  it('returns the page count', async () => {
    const info = await getPdfInfo(await makePdf(4));
    expect(info.pageCount).toBe(4);
    expect(info.isEncrypted).toBe(false);
  });

  it('rejects non-PDF data with a user-facing error', async () => {
    await expect(getPdfInfo(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(UserFacingError);
  });
});

describe('imagesToPdf', () => {
  it('creates one page per image and preserves aspect ratio in fit mode', async () => {
    const progress: number[] = [];
    const bytes = await imagesToPdf([{ bytes: JPEG_2X1 }, { bytes: PNG_1X1 }], {
      onProgress: (done) => progress.push(done),
      title: 'Receipts',
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe('Receipts');
    const [first, second] = doc.getPages();
    expect(first.getWidth() / first.getHeight()).toBeCloseTo(2, 5);
    expect(second.getWidth()).toBeCloseTo(second.getHeight(), 5);
    expect(progress).toEqual([1, 2]);
  });

  it('uses A4 pages, rotating to landscape for wide images', async () => {
    const doc = await PDFDocument.load(await imagesToPdf([{ bytes: JPEG_2X1 }, { bytes: PNG_1X1 }], { pageSize: 'a4', margin: 20 }));
    const [landscape, portrait] = doc.getPages();
    expect(Math.round(landscape.getWidth())).toBe(842);
    expect(Math.round(portrait.getWidth())).toBe(595);
  });

  it('supports receipt and card presets', async () => {
    const receipt = await PDFDocument.load(await imagesToPdf([{ bytes: PNG_1X1 }], { pageSize: 'receipt' }));
    expect(receipt.getPage(0).getWidth()).toBeCloseTo(226.77, 1); // 80 mm
    expect(receipt.getPage(0).getHeight()).toBeCloseTo(226.77, 1);
    const card = await PDFDocument.load(await imagesToPdf([{ bytes: JPEG_2X1 }], { pageSize: 'id-card', margin: 50 }));
    expect(card.getPage(0).getWidth()).toBeCloseTo(242.65, 1); // 85.6 mm, landscape for a wide image
    expect(card.getPage(0).getHeight()).toBeCloseTo(153.02, 1);
    const business = await PDFDocument.load(await imagesToPdf([{ bytes: PNG_1X1 }], { pageSize: 'business-card' }));
    expect(business.getPage(0).getWidth()).toBeCloseTo(155.91, 1); // 55 mm portrait
  });

  it('rejects empty input and unsupported images', async () => {
    await expect(imagesToPdf([])).rejects.toThrow('Select at least one image.');
    await expect(imagesToPdf([{ bytes: new Uint8Array([0, 1, 2, 3]) }])).rejects.toThrow('not a JPEG or PNG');
  });

  it('honours cancellation', async () => {
    await expect(imagesToPdf([{ bytes: PNG_1X1 }], { cancelToken: { cancelled: true } })).rejects.toBeInstanceOf(CancelledError);
  });
});

describe('mergePdfs', () => {
  it('concatenates documents in order', async () => {
    const a = await makePdf(2, 'A'); // widths 300, 301
    const b = await makePdf(3, 'B'); // widths 300, 301, 302
    const merged = await mergePdfs([b, a], { title: 'Merged' });
    expect(await pageWidths(merged)).toEqual([300, 301, 302, 300, 301]);
    expect((await PDFDocument.load(merged)).getTitle()).toBe('Merged');
  });

  it('requires at least two inputs', async () => {
    await expect(mergePdfs([await makePdf(1)])).rejects.toThrow('at least two');
  });
});

describe('split & extract', () => {
  it('splits into groups', async () => {
    const parts = await splitPdf(await makePdf(5), [[0, 1], [4], [2, 3]]);
    expect(parts).toHaveLength(3);
    expect(await pageWidths(parts[0])).toEqual([300, 301]);
    expect(await pageWidths(parts[1])).toEqual([304]);
    expect(await pageWidths(parts[2])).toEqual([302, 303]);
  });

  it('splits into single pages', async () => {
    const parts = await splitIntoSinglePages(await makePdf(3));
    expect(await Promise.all(parts.map(pageWidths))).toEqual([[300], [301], [302]]);
  });

  it('extracts pages in the requested order', async () => {
    expect(await pageWidths(await extractPages(await makePdf(4), [3, 0]))).toEqual([303, 300]);
  });

  it('rejects out-of-range pages', async () => {
    await expect(extractPages(await makePdf(2), [2])).rejects.toThrow('Page 3 does not exist');
    await expect(splitPdf(await makePdf(2), [[0], []])).rejects.toThrow('at least one page');
  });
});

describe('page organisation', () => {
  it('rotates selected pages and normalises angles', async () => {
    const source = await makePdf(3);
    const once = await rotatePages(source, -90, [0, 2]);
    expect(await pageRotations(once)).toEqual([270, 0, 270]);
    const twice = await rotatePages(once, 180);
    expect(await pageRotations(twice)).toEqual([90, 180, 90]);
  });

  it('reorders pages', async () => {
    expect(await pageWidths(await reorderPages(await makePdf(3), [2, 0, 1]))).toEqual([302, 300, 301]);
    await expect(reorderPages(await makePdf(3), [0, 0, 1])).rejects.toThrow('every page exactly once');
  });

  it('deletes pages but never all of them', async () => {
    expect(await pageWidths(await deletePages(await makePdf(4), [1, 2]))).toEqual([300, 303]);
    await expect(deletePages(await makePdf(2), [0, 1])).rejects.toThrow('at least one page');
  });

  it('duplicates a page next to the original', async () => {
    expect(await pageWidths(await duplicatePage(await makePdf(3), 1))).toEqual([300, 301, 301, 302]);
  });

  it('applies a combined plan (reorder + delete + duplicate + rotate)', async () => {
    const out = await applyPagePlan(await makePdf(3), [
      { sourceIndex: 2, rotate: 90 },
      { sourceIndex: 0 },
      { sourceIndex: 0, rotate: 270 },
    ]);
    expect(await pageWidths(out)).toEqual([302, 300, 300]);
    expect(await pageRotations(out)).toEqual([90, 0, 270]);
    await expect(applyPagePlan(await makePdf(1), [{ sourceIndex: 0, rotate: 45 }])).rejects.toThrow('multiple of 90');
  });

  it('does not mutate the input bytes', async () => {
    const source = await makePdf(2);
    const copy = source.slice();
    await rotatePages(source, 90);
    await deletePages(source, [0]);
    expect(Buffer.compare(Buffer.from(source), Buffer.from(copy))).toBe(0);
  });
});
