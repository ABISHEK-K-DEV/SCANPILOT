import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

import { getPdfRenderer } from '@/native/pdfRenderer';
import { type EditorItem, redactionsByPage, toOverlays } from '@/services/editor/model';
import { createDocumentFromBytes } from '@/services/library/documentService';
import { applyOverlays, replacePagesWithImages } from '@/services/pdf/pdfService';
import type { Progress } from '@/services/pdf/types';
import { encodeBmp24 } from '@/services/scan/bmp';
import { fillRects, toRgb } from '@/services/scan/filters';
import { readBytes } from '@/services/storage/fileStore';
import { tempDir } from '@/services/storage/paths';
import type { ScanDocument } from '@/types/document';
import { UserFacingError } from '@/utils/errors';
import { createId } from '@/utils/id';

/** Applies signatures/annotations as a new document; the original is kept. */
export async function saveEdits(doc: ScanDocument, items: readonly EditorItem[], aspects: readonly number[], suffix: string): Promise<ScanDocument> {
  const visible = items.filter((it) => !(it.kind === 'shape' && it.shape === 'redact'));
  const bytes = await applyOverlays(await readBytes(doc.fileUri), toOverlays(visible, (p) => aspects[p] ?? 0.707));
  return createDocumentFromBytes(bytes, { name: `${doc.name} (${suffix})`, source: 'generated', folderId: doc.folderId, pageCount: doc.pageCount ?? undefined });
}

const REDACT_DPI = 200;

/**
 * Secure redaction: each page with boxes is rendered to pixels, the boxes are
 * burned in, and the page is replaced by that image. Text, vectors and hidden
 * content under the boxes no longer exist in the output.
 */
export async function saveRedactions(doc: ScanDocument, items: readonly EditorItem[], onProgress?: Progress): Promise<ScanDocument> {
  const renderer = getPdfRenderer();
  if (!renderer) throw new UserFacingError('Redaction is not available on this device yet.');
  const byPage = redactionsByPage(items);
  if (byPage.size === 0) throw new UserFacingError('Draw at least one box over the content to remove.');
  const dir = new Directory(tempDir(), `redact-${createId()}`);
  dir.create({ intermediates: true, idempotent: true });
  try {
    const replacements: { page: number; jpeg: Uint8Array }[] = [];
    let done = 0;
    for (const [page, rects] of byPage) {
      const rendered = await renderer.renderPage(doc.fileUri, page, { dpi: REDACT_DPI, quality: 0.95, maxEdge: 3400, outputUri: new File(dir, `p${page}.jpg`).uri });
      const decoded = decodeJpeg(await readBytes(rendered.uri), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
      const bmp = new File(dir, `p${page}.bmp`);
      bmp.create({ overwrite: true });
      await bmp.write(encodeBmp24(toRgb(fillRects(decoded, rects))));
      const ctx = ImageManipulator.manipulate(bmp.uri);
      const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      replacements.push({ page, jpeg: await readBytes(saved.uri) });
      new File(saved.uri).delete();
      done += 1;
      onProgress?.(done, byPage.size + 1);
    }
    const bytes = await replacePagesWithImages(await readBytes(doc.fileUri), replacements);
    const created = await createDocumentFromBytes(bytes, { name: `${doc.name} (redacted)`, source: 'generated', folderId: doc.folderId, pageCount: doc.pageCount ?? undefined });
    onProgress?.(byPage.size + 1, byPage.size + 1);
    return created;
  } finally {
    try {
      if (dir.exists) dir.delete();
    } catch {
      // ignore
    }
  }
}
