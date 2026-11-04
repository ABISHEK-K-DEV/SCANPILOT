/**
 * Offline PDF → Office conversions:
 *  - PowerPoint: every page rendered on the phone and placed as a slide.
 *  - Excel: on-device OCR, then rows/columns rebuilt from text positions;
 *    one sheet per page.
 * Nothing is uploaded.
 */
import type { OcrLanguage } from '@/native/ocr';
import { getPdfRenderer } from '@/native/pdfRenderer';
import { buildPptx, type SlideImage } from '@/services/export/pptx';
import { buildXlsx, linesToRows } from '@/services/export/xlsx';
import { recogniseDocument } from '@/services/ocr/ocrService';
import type { CancelToken, Progress } from '@/services/pdf/types';
import { createWorkDir, readBytes } from '@/services/storage/fileStore';
import type { ScanDocument } from '@/types/document';
import { CancelledError, UserFacingError } from '@/utils/errors';
import { createId } from '@/utils/id';

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function pdfToPowerPoint(doc: ScanDocument, options: { onProgress?: Progress; cancelToken?: CancelToken } = {}): Promise<{ bytes: Uint8Array; slides: number }> {
  const renderer = getPdfRenderer();
  if (!renderer) throw new UserFacingError('PDF to PowerPoint is not available on this device yet.');
  const info = await renderer.getInfo(doc.fileUri);
  const dir = createWorkDir('pptx');
  const slides: SlideImage[] = [];
  let size: { width: number; height: number } | undefined;
  for (let i = 0; i < info.pageCount; i += 1) {
    if (options.cancelToken?.cancelled) throw new CancelledError();
    const page = await renderer.renderPage(doc.fileUri, i, { dpi: 170, quality: 0.88, maxEdge: 2400, outputUri: dir.fileUri(`${createId()}.jpg`) });
    if (!size) size = { width: page.pageWidth, height: page.pageHeight };
    slides.push({ jpeg: await readBytes(page.uri), width: page.width, height: page.height });
    options.onProgress?.(i + 1, info.pageCount + 1);
  }
  const bytes = buildPptx(slides, { title: doc.name, pageSizePt: size });
  options.onProgress?.(info.pageCount + 1, info.pageCount + 1);
  return { bytes, slides: slides.length };
}

export async function pdfToExcel(
  doc: ScanDocument,
  language: OcrLanguage,
  options: { onProgress?: Progress; cancelToken?: CancelToken } = {},
): Promise<{ bytes: Uint8Array; rows: number }> {
  const run = await recogniseDocument(doc, language, options);
  const sheets = run.pages.map((p, i) => ({ name: `Page ${i + 1}`, rows: linesToRows(p.lines) }));
  const rows = sheets.reduce((n, s) => n + s.rows.length, 0);
  if (rows === 0) throw new UserFacingError('No text or tables were found in this PDF.');
  return { bytes: buildXlsx(sheets), rows };
}
