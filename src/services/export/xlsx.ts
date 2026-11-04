/**
 * Minimal Excel (.xlsx) writer with inline strings, plus a helper that turns
 * OCR text lines into table rows/columns. Used by "PDF to Excel": each page
 * becomes a sheet; numbers are written as numbers so they can be summed.
 * Pure: no React, no native code.
 */
import { strToU8, zipSync } from 'fflate';

export interface Sheet {
  name: string;
  rows: readonly (readonly string[])[];
}

export interface OcrBox {
  text: string;
  box: { x: number; y: number; width: number; height: number };
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const escapeXml = (t: string) =>
  t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;

function cell(ref: string, value: string): string {
  const v = value.trim();
  if (NUMBER.test(v)) return `<c r="${ref}"><v>${v.replace(/,/g, '')}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}

/** Excel sheet names: ≤31 chars, no []:*?/\ and unique. */
function sheetNames(sheets: readonly Sheet[]): string[] {
  const used = new Set<string>();
  return sheets.map((s, i) => {
    let base = s.name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Sheet ${i + 1}`;
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) {
      const suffix = ` (${n++})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    base = name;
    return base;
  });
}

export function buildXlsx(sheets: readonly Sheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error('A workbook needs at least one sheet.');
  const names = sheetNames(sheets);
  const files: Record<string, Uint8Array> = {};
  files['[Content_Types].xml'] = strToU8(
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`,
  );
  files['_rels/.rels'] = strToU8(
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  files['xl/workbook.xml'] = strToU8(
    `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
      .map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}</Relationships>`,
  );
  sheets.forEach((sheet, i) => {
    const rows = sheet.rows
      .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => (v.trim() ? cell(`${columnName(c)}${r + 1}`, v) : '')).join('')}</row>`)
      .join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
  });
  return zipSync(files);
}

/**
 * Rebuilds table structure from OCR line boxes: lines whose vertical centres
 * are close form a row; within the whole page, distinct left edges become
 * columns, so values line up under their headers.
 */
export function linesToRows(lines: readonly OcrBox[]): string[][] {
  const items = lines.filter((l) => l.text.trim()).map((l) => ({ text: l.text.trim(), x: l.box.x, cy: l.box.y + l.box.height / 2, h: l.box.height }));
  if (items.length === 0) return [];
  const heights = items.map((i) => i.h).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] || 0.01;

  // Rows: sort by centre, start a new row when the gap exceeds ~60% of a line height.
  items.sort((a, b) => a.cy - b.cy);
  const rows: (typeof items)[] = [];
  for (const item of items) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(item.cy - row[0].cy) <= median * 0.6) row.push(item);
    else rows.push([item]);
  }

  // Columns: cluster left edges across the page.
  const lefts = items.map((i) => i.x).sort((a, b) => a - b);
  const columns: number[] = [];
  for (const x of lefts) {
    if (columns.length === 0 || x - columns[columns.length - 1] > 0.04) columns.push(x);
  }
  const columnOf = (x: number) => {
    let best = 0;
    for (let c = 0; c < columns.length; c += 1) if (Math.abs(columns[c] - x) < Math.abs(columns[best] - x)) best = c;
    return best;
  };

  return rows.map((row) => {
    const out: string[] = new Array(columns.length).fill('');
    row
      .sort((a, b) => a.x - b.x)
      .forEach((item) => {
        let c = columnOf(item.x);
        while (out[c] && c < out.length - 1) c += 1;
        out[c] = out[c] ? `${out[c]} ${item.text}` : item.text;
      });
    // Trim trailing empty cells.
    let end = out.length;
    while (end > 0 && !out[end - 1]) end -= 1;
    return out.slice(0, end);
  });
}
