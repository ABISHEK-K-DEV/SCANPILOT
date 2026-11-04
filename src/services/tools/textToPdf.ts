import { printToFileAsync } from 'expo-print';

import { createDocumentFromFile } from '@/services/library/documentService';
import type { ScanDocument } from '@/types/document';
import { UserFacingError } from '@/utils/errors';

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type TextStyle = 'document' | 'letter' | 'notes';

/** Builds print HTML: system fonts render any script (Hindi, Tamil, Arabic…). */
export function textToHtml(title: string, body: string, style: TextStyle, fontSize: number): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const lined = style === 'notes' ? 'background-image: repeating-linear-gradient(transparent, transparent 27px, #cfdcf1 28px); line-height: 28px;' : `line-height: 1.5;`;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { margin: 22mm 18mm; }
    body { font-family: ${style === 'letter' ? "Georgia, 'Noto Serif', serif" : "-apple-system, Roboto, 'Noto Sans', 'Noto Sans Devanagari', sans-serif"}; font-size: ${fontSize}pt; color: #0B1B3F; ${lined} }
    h1 { font-size: ${Math.round(fontSize * 1.7)}pt; margin: 0 0 14pt; }
    p { margin: 0 0 ${style === 'notes' ? 0 : 10}pt; white-space: normal; word-wrap: break-word; }
  </style></head><body>${title.trim() ? `<h1>${escapeHtml(title.trim())}</h1>` : ''}${paragraphs}</body></html>`;
}

export async function createTextPdf(title: string, body: string, style: TextStyle, fontSize: number): Promise<ScanDocument> {
  if (!title.trim() && !body.trim()) throw new UserFacingError('Write something first.');
  const { uri } = await printToFileAsync({ html: textToHtml(title, body, style, fontSize) });
  return createDocumentFromFile(uri, { name: title.trim() || 'Note', source: 'generated' });
}
