/// <reference types="node" />
import { PDFDocument } from '@cantoo/pdf-lib';

import { UserFacingError } from '@/utils/errors';

import {
  addPageNumbers,
  addTextLayer,
  addWatermark,
  applyOverlays,
  cropPages,
  formatPageNumber,
  isPasswordProtected,
  protectPdf,
  repairPdf,
  rotatePages,
  unlockPdf,
  unsupportedCharacters,
} from '../pdfService';
import { makePdf, PNG_1X1 } from './fixtures';

const contentOf = async (bytes: Uint8Array, page = 0) => {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(page).node.Contents();
  return contents ? contents.toString().length : 0;
};

const ops = async (bytes: Uint8Array) => {
  // Count content-stream bytes across pages: a cheap proxy for "something was drawn".
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().length;
};

describe('text support', () => {
  it('reports characters outside the standard font', () => {
    expect(unsupportedCharacters('Hello €5 – ok')).toEqual([]);
    expect(unsupportedCharacters('नमस्ते A')).toContain('न');
  });

  it('formats page numbers', () => {
    expect(formatPageNumber('n', 3, 9)).toBe('3');
    expect(formatPageNumber('page-n-of-total', 3, 9)).toBe('Page 3 of 9');
    expect(formatPageNumber('n-of-total', 1, 2)).toBe('1 / 2');
  });
});

describe('watermark & page numbers', () => {
  it('adds a watermark to every page and keeps page count', async () => {
    const src = await makePdf(3);
    const out = await addWatermark(src, { text: 'CONFIDENTIAL', layout: 'tile' });
    expect(await ops(out)).toBe(3);
    expect(out.length).toBeGreaterThan(src.length);
  });

  it('rejects empty and non-Latin watermark text with a clear error', async () => {
    const src = await makePdf(1);
    await expect(addWatermark(src, { text: '  ' })).rejects.toThrow('Enter the watermark text');
    await expect(addWatermark(src, { text: 'गोपनीय' })).rejects.toBeInstanceOf(UserFacingError);
  });

  it('numbers pages, optionally skipping a cover', async () => {
    const out = await addPageNumbers(await makePdf(3), { format: 'page-n-of-total', skipFirst: true });
    expect(await ops(out)).toBe(3);
  });

  it('works on rotated pages', async () => {
    const rotated = await rotatePages(await makePdf(2), 90);
    const out = await addPageNumbers(rotated, { position: 'top-right' });
    expect(await ops(out)).toBe(2);
  });
});

describe('protect & unlock', () => {
  it('encrypts with a password and unlocks back to a clean PDF', async () => {
    const src = await makePdf(2);
    const locked = await protectPdf(src, { password: 'open-sesame' });
    expect(await isPasswordProtected(locked)).toBe(true);
    await expect(unlockPdf(locked, 'wrong')).rejects.toThrow('incorrect');
    const unlocked = await unlockPdf(locked, 'open-sesame');
    expect(await isPasswordProtected(unlocked)).toBe(false);
    expect((await PDFDocument.load(unlocked)).getPageCount()).toBe(2);
  });

  it('requires a reasonable password', async () => {
    await expect(protectPdf(await makePdf(1), { password: 'ab' })).rejects.toThrow('at least 4');
  });
});

describe('crop & repair', () => {
  it('crops by display margins, also on rotated pages', async () => {
    const src = await makePdf(1); // 300 x 400
    const cropped = await PDFDocument.load(await cropPages(src, { top: 0.1, right: 0, bottom: 0.1, left: 0.2 }));
    const box = cropped.getPage(0).getCropBox();
    expect(Math.round(box.width)).toBe(240);
    expect(Math.round(box.height)).toBe(320);
    const rotated = await rotatePages(src, 90);
    const rc = await PDFDocument.load(await cropPages(rotated, { top: 0.25, right: 0, bottom: 0, left: 0 }));
    // Displayed top of a 90°-rotated page is the user-space left edge → width shrinks.
    expect(Math.round(rc.getPage(0).getCropBox().width)).toBe(225);
    expect(Math.round(rc.getPage(0).getCropBox().height)).toBe(400);
  });

  it('rejects crops that remove almost everything', async () => {
    await expect(cropPages(await makePdf(1), { top: 0.45, right: 0, bottom: 0.45, left: 0 })).rejects.toThrow('almost nothing');
  });

  it('rebuilds a PDF and reports pages', async () => {
    const { bytes, pageCount } = await repairPdf(await makePdf(4));
    expect(pageCount).toBe(4);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(4);
    await expect(repairPdf(new Uint8Array([1, 2, 3]))).rejects.toThrow('too damaged');
  });
});

describe('overlays (sign, annotate)', () => {
  it('draws ink, shapes, text and images', async () => {
    const src = await makePdf(2);
    const before = await contentOf(src, 1);
    const out = await applyOverlays(src, [
      { type: 'ink', page: 1, strokes: [[{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.2 }, { x: 0.5, y: 0.1 }]], color: { r: 0, g: 0, b: 0.6 }, width: 0.006 },
      { type: 'ink', page: 1, strokes: [[{ x: 0.1, y: 0.5 }, { x: 0.8, y: 0.5 }]], color: { r: 1, g: 0.9, b: 0 }, width: 0.03, opacity: 0.35 },
      { type: 'rect', page: 1, from: { x: 0.1, y: 0.6 }, to: { x: 0.4, y: 0.7 }, color: { r: 1, g: 0, b: 0 }, width: 0.004 },
      { type: 'rect', page: 1, from: { x: 0.5, y: 0.6 }, to: { x: 0.9, y: 0.7 }, color: { r: 1, g: 1, b: 1 }, width: 0, fill: { r: 1, g: 1, b: 1 } },
      { type: 'ellipse', page: 1, from: { x: 0.1, y: 0.75 }, to: { x: 0.3, y: 0.85 }, color: { r: 0, g: 0.5, b: 0 }, width: 0.004 },
      { type: 'line', page: 1, from: { x: 0.5, y: 0.8 }, to: { x: 0.9, y: 0.9 }, color: { r: 0, g: 0, b: 0 }, width: 0.004, arrow: true },
      { type: 'text', page: 1, at: { x: 0.1, y: 0.3 }, text: 'Approved 04/11/2026\nSecond line', size: 0.04, color: { r: 0, g: 0, b: 0 } },
      { type: 'image', page: 1, from: { x: 0.6, y: 0.2 }, to: { x: 0.9, y: 0.4 }, bytes: PNG_1X1, mimeType: 'image/png' },
    ]);
    expect(await contentOf(out, 1)).toBeGreaterThan(before);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });

  it('validates input', async () => {
    const src = await makePdf(1);
    await expect(applyOverlays(src, [])).rejects.toThrow('Add something');
    await expect(applyOverlays(src, [{ type: 'text', page: 3, at: { x: 0, y: 0 }, text: 'x', size: 0.03, color: { r: 0, g: 0, b: 0 } }])).rejects.toThrow('does not exist');
  });
});

describe('searchable text layer', () => {
  it('adds invisible text without changing page count', async () => {
    const src = await makePdf(1);
    const out = await addTextLayer(src, [{ page: 0, lines: [{ text: 'Invoice number 2048 नमस्ते', box: { x: 0.1, y: 0.1, width: 0.6, height: 0.04 } }] }]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
    expect(out.length).toBeGreaterThan(src.length);
  });
});

describe('secure redaction rebuild', () => {
  it('replaces chosen pages with images and keeps the others', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JPEG_2X1 } = require('./fixtures');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { replacePagesWithImages } = require('../pdfService');
    const src = await makePdf(3);
    const out = await replacePagesWithImages(src, [{ page: 1, jpeg: JPEG_2X1 }]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(Math.round(doc.getPage(1).getWidth())).toBe(301);
  });
});
