/** Demo stand-in: page thumbnails come from the sample page images. */
import type { ScanDocument } from '@/types/document';

export async function loadPageCount(doc: ScanDocument): Promise<number> {
  return doc.pageCount ?? 1;
}
export function renderPageThumbnails(doc: ScanDocument, pageCount: number, onPage: (index: number, uri: string) => void) {
  const base = doc.fileUri.split('?')[0];
  for (let i = 0; i < pageCount; i += 1) onPage(i, `${base}page-${(i % 2) + 1}.png`);
  return { done: Promise.resolve(), cleanup: () => undefined };
}
export async function saveOrganised(doc: ScanDocument): Promise<ScanDocument> {
  return doc;
}
export async function extractToNewDocument(doc: ScanDocument): Promise<ScanDocument> {
  return doc;
}
