import { createDocumentFromBytes } from '@/services/library/documentService';
import { mergePdfs } from '@/services/pdf/pdfService';
import type { CancelToken, Progress } from '@/services/pdf/types';
import { readBytes } from '@/services/storage/fileStore';
import type { ScanDocument } from '@/types/document';
import { CancelledError } from '@/utils/errors';

/** Merges documents in the given order into a new library document. Originals are untouched. */
export async function mergeDocuments(
  docs: readonly ScanDocument[],
  options: { name: string; folderId?: string | null; onProgress?: Progress; cancelToken?: CancelToken },
): Promise<ScanDocument> {
  const total = docs.length + 1;
  const inputs: Uint8Array[] = [];
  for (let i = 0; i < docs.length; i += 1) {
    if (options.cancelToken?.cancelled) throw new CancelledError();
    inputs.push(await readBytes(docs[i].fileUri));
    options.onProgress?.(i + 1, total);
  }
  const bytes = await mergePdfs(inputs, { title: options.name, cancelToken: options.cancelToken });
  const pageCount = docs.every((d) => d.pageCount !== null) ? docs.reduce((sum, d) => sum + (d.pageCount ?? 0), 0) : undefined;
  const doc = await createDocumentFromBytes(bytes, {
    name: options.name,
    source: 'generated',
    folderId: options.folderId ?? null,
    pageCount,
  });
  options.onProgress?.(total, total);
  return doc;
}
