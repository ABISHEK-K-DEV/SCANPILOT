/// <reference types="node" />
/**
 * Writes one sample output per PDF operation when PDF_EXPORT_DIR is set, so
 * they can be validated with independent readers (poppler `pdfinfo`, pypdf):
 *   npm run test:pdf-readers
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  addPageNumbers,
  addTextLayer,
  addWatermark,
  applyOverlays,
  applyPagePlan,
  cropPages,
  extractPages,
  imagesToPdf,
  mergePdfs,
  protectPdf,
  rotatePages,
  splitIntoSinglePages,
  unlockPdf,
} from '../pdfService';
import { JPEG_2X1, makePdf, PNG_1X1 } from './fixtures';

const outDir = process.env.PDF_EXPORT_DIR;
const maybe = outDir ? it : it.skip;

describe('export samples for external validation', () => {
  maybe('writes sample PDFs', async () => {
    const dir = outDir as string;
    fs.mkdirSync(dir, { recursive: true });
    const write = (name: string, bytes: Uint8Array) => fs.writeFileSync(path.join(dir, name), bytes);
    const five = await makePdf(5, 'Source');
    write('images.pdf', await imagesToPdf([{ bytes: JPEG_2X1 }, { bytes: PNG_1X1 }], { pageSize: 'a4', margin: 24, title: 'Images' }));
    write('merge.pdf', await mergePdfs([five, await makePdf(2, 'Second')], { title: 'Merged' }));
    write('extract.pdf', await extractPages(five, [4, 0]));
    write('rotate.pdf', await rotatePages(five, 90, [1, 3]));
    write('plan.pdf', await applyPagePlan(five, [{ sourceIndex: 2, rotate: 180 }, { sourceIndex: 0 }, { sourceIndex: 0 }]));
    (await splitIntoSinglePages(await makePdf(3))).forEach((bytes, i) => write(`split-${i + 1}.pdf`, bytes));
    write('watermark.pdf', await addWatermark(five, { text: 'CONFIDENTIAL' }));
    // Page numbers on a page rotated 90°: must read upright at the displayed bottom-right.
    write('numbers-rotated.pdf', await addPageNumbers(await rotatePages(await makePdf(2), 90), { position: 'bottom-right', format: 'page-n-of-total' }));
    const locked = await protectPdf(five, { password: 'test1234' });
    write('protected.pdf', locked);
    write('unlocked.pdf', await unlockPdf(locked, 'test1234'));
    write('cropped.pdf', await cropPages(five, { top: 0.25, right: 0, bottom: 0, left: 0 }));
    // Red box in the displayed top-left quarter of a rotated page.
    write('overlay-rotated.pdf', await applyOverlays(await rotatePages(await makePdf(1), 90), [
      { type: 'rect', page: 0, from: { x: 0.05, y: 0.05 }, to: { x: 0.3, y: 0.3 }, color: { r: 1, g: 0, b: 0 }, width: 0, fill: { r: 1, g: 0, b: 0 } },
      { type: 'text', page: 0, at: { x: 0.05, y: 0.6 }, text: 'Signed here', size: 0.05, color: { r: 0, g: 0, b: 0 } },
    ]));
    write('searchable.pdf', await addTextLayer(await makePdf(1), [{ page: 0, lines: [{ text: 'Invoice number 2048', box: { x: 0.1, y: 0.5, width: 0.6, height: 0.05 } }] }]));
    expect(fs.readdirSync(dir).length).toBeGreaterThanOrEqual(15);
  });
});
