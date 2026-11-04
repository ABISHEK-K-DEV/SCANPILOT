import { createDocumentFromBytes } from '@/services/library/documentService';
import { getPdfInfo, splitPdf } from '@/services/pdf/pdfService';
import { describePages, parsePageRanges, parseRangeGroups } from '@/services/pdf/pageRanges';
import type { CancelToken, Progress } from '@/services/pdf/types';
import { readBytes } from '@/services/storage/fileStore';
import type { ScanDocument } from '@/types/document';
import { CancelledError } from '@/utils/errors';

export type SplitMode = { kind: 'each' } | { kind: 'ranges'; expression: string } | { kind: 'extract'; expression: string };

/** Page groups for a mode; throws a readable error for invalid expressions. */
export function planSplit(mode: SplitMode, pageCount: number): number[][] {
  switch (mode.kind) {
    case 'each':
      return Array.from({ length: pageCount }, (_, i) => [i]);
    case 'ranges':
      return parseRangeGroups(mode.expression, pageCount);
    case 'extract':
      return [parsePageRanges(mode.expression, pageCount)];
  }
}

/** Creates one new library document per group. The original is untouched. */
export async function splitDocument(
  doc: ScanDocument,
  mode: SplitMode,
  options: { onProgress?: Progress; cancelToken?: CancelToken } = {},
): Promise<ScanDocument[]> {
  const bytes = await readBytes(doc.fileUri);
  const { pageCount } = await getPdfInfo(bytes);
  const groups = planSplit(mode, pageCount);
  const total = groups.length * 2;
  const parts = await splitPdf(bytes, groups, {
    cancelToken: options.cancelToken,
    onProgress: (done) => options.onProgress?.(done, total),
  });
  const created: ScanDocument[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (options.cancelToken?.cancelled) throw new CancelledError();
    created.push(
      await createDocumentFromBytes(parts[i], {
        name: `${doc.name} – ${describePages(groups[i])}`,
        source: 'generated',
        folderId: doc.folderId,
        pageCount: groups[i].length,
      }),
    );
    options.onProgress?.(groups.length + i + 1, total);
  }
  return created;
}
