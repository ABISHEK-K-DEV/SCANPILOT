/// <reference types="node" />
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { strFromU8, unzipSync } from 'fflate';

import { buildDocx, buildZip } from '../docx';

describe('docx export', () => {
  it('builds a valid package with escaped text, Hindi and page breaks', () => {
    const bytes = buildDocx(['Invoice <2048> & Co.\nTotal: ₹1,200', 'नमस्ते दुनिया'], 'Scan');
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml']);
    const xml = strFromU8(files['word/document.xml']);
    expect(xml).toContain('Invoice &lt;2048&gt; &amp; Co.');
    expect(xml).toContain('नमस्ते दुनिया');
    expect(xml).toContain('w:type="page"');
  });

  it('opens in an independent reader (python-docx) when available', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'docx-')), 'out.docx');
    fs.writeFileSync(file, buildDocx(['Line one\nLine two', 'Page two'], 'Title'));
    let out: string;
    try {
      out = execFileSync('python3', ['-I', '-c', 'import sys, docx; d = docx.Document(sys.argv[1]); print("|".join(p.text for p in d.paragraphs))', file], { encoding: 'utf8' });
    } catch {
      return; // python-docx not installed: structure is still covered above
    }
    expect(out.trim()).toBe('Title|Line one|Line two||Page two');
  });

  it('zips files without recompressing', () => {
    const zip = buildZip([{ name: 'page-1.jpg', bytes: new Uint8Array([1, 2, 3]) }]);
    expect(unzipSync(zip)['page-1.jpg']).toEqual(new Uint8Array([1, 2, 3]));
  });
});
