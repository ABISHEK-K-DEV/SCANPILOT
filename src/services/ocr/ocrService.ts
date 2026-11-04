/**
 * Offline OCR orchestration. PDF pages are rendered on-device, recognised by
 * the on-device engine, and the text is stored locally for library search.
 * Nothing is sent to any server.
 */
import { Directory, File } from 'expo-file-system';

import { saveDocumentText } from '@/db/textRepository';
import { getOcrProvider, type OcrLanguage, type RecognisedPage } from '@/native/ocr';
import { getPdfRenderer } from '@/native/pdfRenderer';
import { createDocumentFromBytes } from '@/services/library/documentService';
import { addTextLayer } from '@/services/pdf/pdfService';
import type { CancelToken, Progress } from '@/services/pdf/types';
import { readBytes } from '@/services/storage/fileStore';
import { tempDir } from '@/services/storage/paths';
import type { ScanDocument } from '@/types/document';
import { CancelledError, UserFacingError } from '@/utils/errors';
import { createId } from '@/utils/id';

/** 220 dpi is a good balance for ML Kit accuracy vs. speed on mid-range phones. */
const OCR_DPI = 220;
const OCR_MAX_EDGE = 3000;

export function isOcrSupported(): boolean {
  return getOcrProvider() !== null && getPdfRenderer() !== null;
}

function requireProvider() {
  const provider = getOcrProvider();
  if (!provider) throw new UserFacingError('Text recognition is not available on this device yet.');
  return provider;
}

export interface OcrRun {
  pages: RecognisedPage[];
}

export async function recogniseDocument(
  doc: ScanDocument,
  language: OcrLanguage,
  options: { onProgress?: Progress; cancelToken?: CancelToken; pages?: number[] } = {},
): Promise<OcrRun> {
  const provider = requireProvider();
  const renderer = getPdfRenderer();
  if (!renderer) throw new UserFacingError('Text recognition is not available on this device yet.');
  const info = await renderer.getInfo(doc.fileUri);
  const indices = options.pages ?? Array.from({ length: info.pageCount }, (_, i) => i);
  const dir = new Directory(tempDir(), `ocr-${createId()}`);
  dir.create({ intermediates: true, idempotent: true });
  try {
    const pages: RecognisedPage[] = [];
    for (let i = 0; i < indices.length; i += 1) {
      if (options.cancelToken?.cancelled) throw new CancelledError();
      const out = new File(dir, `p${indices[i]}.jpg`);
      const rendered = await renderer.renderPage(doc.fileUri, indices[i], { dpi: OCR_DPI, quality: 0.9, maxEdge: OCR_MAX_EDGE, outputUri: out.uri });
      pages.push(await provider.recognise(rendered.uri, language));
      out.delete();
      options.onProgress?.(i + 1, indices.length);
    }
    if (!options.pages) await saveDocumentText(doc.id, pages.map((p) => p.text));
    return { pages };
  } finally {
    try {
      if (dir.exists) dir.delete();
    } catch {
      // Temp is wiped on next launch.
    }
  }
}

export async function recogniseImages(uris: readonly string[], language: OcrLanguage, options: { onProgress?: Progress; cancelToken?: CancelToken } = {}): Promise<OcrRun> {
  const provider = requireProvider();
  const pages: RecognisedPage[] = [];
  for (let i = 0; i < uris.length; i += 1) {
    if (options.cancelToken?.cancelled) throw new CancelledError();
    pages.push(await provider.recognise(uris[i], language));
    options.onProgress?.(i + 1, uris.length);
  }
  return { pages };
}

/** Counts case-insensitive matches of `query` per page. */
export function findMatches(pages: readonly { text: string }[], query: string): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages.map(() => 0);
  return pages.map((p) => {
    const text = p.text.toLowerCase();
    let count = 0;
    let at = text.indexOf(q);
    while (at !== -1) {
      count += 1;
      at = text.indexOf(q, at + q.length);
    }
    return count;
  });
}

export function joinPages(pages: readonly { text: string }[]): string {
  return pages.map((p, i) => (pages.length > 1 ? `--- Page ${i + 1} ---\n${p.text}` : p.text)).join('\n\n');
}

/** Creates a searchable copy: original page images plus an invisible text layer. */
export async function makeSearchablePdf(doc: ScanDocument, run: OcrRun): Promise<ScanDocument> {
  const bytes = await addTextLayer(
    await readBytes(doc.fileUri),
    run.pages.map((p, page) => ({ page, lines: p.lines })),
  );
  return createDocumentFromBytes(bytes, { name: `${doc.name} (searchable)`, source: 'generated', folderId: doc.folderId, pageCount: run.pages.length });
}
