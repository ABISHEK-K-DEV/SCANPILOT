/// <reference types="node" />
/**
 * Writes one sample output per PDF operation when PDF_EXPORT_DIR is set, so
 * they can be validated with independent readers (poppler `pdfinfo`, pypdf):
 *   npm run test:pdf-readers
 */
import * as fs from 'fs';
import * as path from 'path';

import { applyPagePlan, extractPages, imagesToPdf, mergePdfs, rotatePages, splitIntoSinglePages } from '../pdfService';
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
    expect(fs.readdirSync(dir).length).toBeGreaterThanOrEqual(8);
  });
});
