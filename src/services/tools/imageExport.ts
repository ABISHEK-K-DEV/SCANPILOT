import { getPdfRenderer } from '@/native/pdfRenderer';
import type { CancelToken, Progress } from '@/services/pdf/types';
import { createWorkDir, readBytes } from '@/services/storage/fileStore';
import type { ScanDocument } from '@/types/document';
import { CancelledError, UserFacingError } from '@/utils/errors';
import { sanitizeDocumentName } from '@/utils/filename';
import { createId } from '@/utils/id';

export interface ExportedImage {
  name: string;
  bytes: Uint8Array;
  uri: string;
}

export const IMAGE_QUALITY = { standard: { dpi: 150, quality: 0.85 }, high: { dpi: 220, quality: 0.9 }, max: { dpi: 300, quality: 0.92 } } as const;
export type ImageQuality = keyof typeof IMAGE_QUALITY;

/** Renders pages to JPEG files (kept in temp for previews/sharing until the next launch). */
export async function exportPagesAsImages(
  doc: ScanDocument,
  quality: ImageQuality,
  options: { pages?: number[]; onProgress?: Progress; cancelToken?: CancelToken } = {},
): Promise<ExportedImage[]> {
  const renderer = getPdfRenderer();
  if (!renderer) throw new UserFacingError('Exporting images is not available on this device yet.');
  const info = await renderer.getInfo(doc.fileUri);
  const pages = options.pages ?? Array.from({ length: info.pageCount }, (_, i) => i);
  const dir = createWorkDir('images');
  const base = sanitizeDocumentName(doc.name);
  const pad = String(info.pageCount).length;
  const out: ExportedImage[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    if (options.cancelToken?.cancelled) throw new CancelledError();
    const name = `${base} - page ${String(pages[i] + 1).padStart(pad, '0')}.jpg`;
    const { dpi, quality: q } = IMAGE_QUALITY[quality];
    const rendered = await renderer.renderPage(doc.fileUri, pages[i], { dpi, quality: q, maxEdge: 5000, outputUri: dir.fileUri(`${createId()}.jpg`) });
    out.push({ name, bytes: await readBytes(rendered.uri), uri: rendered.uri });
    options.onProgress?.(i + 1, pages.length);
  }
  return out;
}
