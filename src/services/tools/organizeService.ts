import { Directory, File } from 'expo-file-system';

import { getPdfRenderer } from '@/native/pdfRenderer';
import { createDocumentFromBytes, replaceDocumentContent } from '@/services/library/documentService';
import type { PlanPage } from '@/services/pdf/pagePlan';
import { applyPagePlan, extractPages, getPdfInfo } from '@/services/pdf/pdfService';
import { readBytes } from '@/services/storage/fileStore';
import { tempDir } from '@/services/storage/paths';
import type { ScanDocument } from '@/types/document';
import { createId } from '@/utils/id';

export async function loadPageCount(doc: ScanDocument): Promise<number> {
  const renderer = getPdfRenderer();
  if (renderer) {
    try {
      return (await renderer.getInfo(doc.fileUri)).pageCount;
    } catch {
      // Fall back to pdf-lib below (e.g. renderer refused an unusual file).
    }
  }
  return (await getPdfInfo(await readBytes(doc.fileUri))).pageCount;
}

/**
 * Renders small page thumbnails one by one, calling `onPage` as each is ready
 * so the grid fills progressively. Returns a cleanup function that deletes them.
 * Does nothing when no native renderer is available (grid shows page numbers).
 */
export function renderPageThumbnails(
  doc: ScanDocument,
  pageCount: number,
  onPage: (index: number, uri: string) => void,
  isCancelled: () => boolean,
): { done: Promise<void>; cleanup: () => void } {
  const renderer = getPdfRenderer();
  const dir = new Directory(tempDir(), `pages-${createId()}`);
  const cleanup = () => {
    try {
      if (dir.exists) dir.delete();
    } catch {
      // ignore
    }
  };
  if (!renderer) return { done: Promise.resolve(), cleanup };
  dir.create({ intermediates: true, idempotent: true });
  const done = (async () => {
    for (let i = 0; i < pageCount; i += 1) {
      if (isCancelled()) return;
      try {
        const out = new File(dir, `${i}.jpg`);
        const page = await renderer.renderPage(doc.fileUri, i, { dpi: 36, quality: 0.7, maxEdge: 360, outputUri: out.uri });
        if (!isCancelled()) onPage(i, page.uri);
      } catch {
        // Leave the placeholder for pages that fail to render.
      }
    }
  })();
  return { done, cleanup };
}

const toEntries = (plan: readonly PlanPage[]) => plan.map((p) => ({ sourceIndex: p.sourceIndex, rotate: p.rotate }));

export async function saveOrganised(doc: ScanDocument, plan: readonly PlanPage[], mode: 'copy' | 'replace'): Promise<ScanDocument> {
  const bytes = await applyPagePlan(await readBytes(doc.fileUri), toEntries(plan));
  if (mode === 'replace') return replaceDocumentContent(doc.id, bytes, plan.length);
  return createDocumentFromBytes(bytes, { name: `${doc.name} (edited)`, source: 'generated', folderId: doc.folderId, pageCount: plan.length });
}

/** Extracts the given plan pages (with their rotations) into a new document. */
export async function extractToNewDocument(doc: ScanDocument, pages: readonly PlanPage[]): Promise<ScanDocument> {
  const source = await readBytes(doc.fileUri);
  const bytes = pages.some((p) => p.rotate !== 0) ? await applyPagePlan(source, toEntries(pages)) : await extractPages(source, pages.map((p) => p.sourceIndex));
  return createDocumentFromBytes(bytes, { name: `${doc.name} (extract)`, source: 'generated', folderId: doc.folderId, pageCount: pages.length });
}
