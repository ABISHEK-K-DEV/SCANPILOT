/// <reference types="node" />
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { strFromU8, unzipSync } from 'fflate';

import { JPEG_2X1 } from '@/services/pdf/__tests__/fixtures';

import { buildPptx } from '../pptx';
import { buildXlsx, columnName, linesToRows } from '../xlsx';

/** Runs an independent reader; skips only when python or the library is missing (a bad file still fails). */
function tryPython(module: string, script: string, file: string): string | null {
  try {
    execFileSync('python3', ['-I', '-c', `import ${module}`], { stdio: 'ignore' });
  } catch {
    return null;
  }
  return execFileSync('python3', ['-I', '-c', script, file], { encoding: 'utf8' }).trim();
}

describe('pptx export', () => {
  it('builds one picture slide per page', () => {
    const bytes = buildPptx(
      [
        { jpeg: JPEG_2X1, width: 595, height: 842 },
        { jpeg: JPEG_2X1, width: 842, height: 595 },
      ],
      { title: 'Deck & notes' },
    );
    const files = unzipSync(bytes);
    expect(files['ppt/slides/slide1.xml']).toBeDefined();
    expect(files['ppt/slides/slide2.xml']).toBeDefined();
    expect(files['ppt/media/image2.jpeg']).toEqual(JPEG_2X1);
    expect(strFromU8(files['docProps/core.xml'])).toContain('Deck &amp; notes');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-')), 'out.pptx');
    fs.writeFileSync(file, bytes);
    const out = tryPython('pptx', 'import sys, pptx; p = pptx.Presentation(sys.argv[1]); print(len(p.slides), sum(1 for s in p.slides for sh in s.shapes if sh.shape_type == 13))', file);
    if (out !== null) expect(out).toBe('2 2');
  });
});

describe('xlsx export', () => {
  it('names columns like Excel', () => {
    expect([0, 25, 26, 27, 701].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ']);
  });

  it('writes numbers as numbers and text as strings', () => {
    const bytes = buildXlsx([{ name: 'Page 1', rows: [['Item', 'Qty', 'Price'], ['Tea <green>', '2', '1,250.50']] }]);
    const sheet = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<c r="B2"><v>2</v></c>');
    expect(sheet).toContain('<c r="C2"><v>1250.50</v></c>');
    expect(sheet).toContain('Tea &lt;green&gt;');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-')), 'out.xlsx');
    fs.writeFileSync(file, bytes);
    const out = tryPython('openpyxl', 'import sys, openpyxl; ws = openpyxl.load_workbook(sys.argv[1]).active; print(ws.title, ws["A1"].value, ws["C2"].value, ws["A2"].value)', file);
    if (out !== null) expect(out).toBe('Page 1 Item 1250.5 Tea <green>');
  });

  it('rebuilds rows and aligned columns from OCR line boxes', () => {
    const box = (text: string, x: number, y: number) => ({ text, box: { x, y, width: 0.1, height: 0.02 } });
    const rows = linesToRows([
      box('Qty', 0.5, 0.1),
      box('Item', 0.1, 0.1),
      box('Price', 0.8, 0.101),
      box('Coffee', 0.1, 0.15),
      box('4', 0.5, 0.151),
      box('320', 0.8, 0.149),
      box('Total', 0.1, 0.2),
      box('320', 0.8, 0.2),
    ]);
    expect(rows).toEqual([
      ['Item', 'Qty', 'Price'],
      ['Coffee', '4', '320'],
      ['Total', '', '320'],
    ]);
  });

  it('makes sheet names valid and unique', () => {
    const files = unzipSync(buildXlsx([{ name: 'a/b', rows: [] }, { name: 'A B', rows: [] }]));
    const wb = strFromU8(files['xl/workbook.xml']);
    expect(wb).toContain('name="a b"');
    expect(wb).toContain('name="A B (2)"');
  });
});
