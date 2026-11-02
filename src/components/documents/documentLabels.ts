import type { ScanDocument } from '@/types/document';
import { formatBytes, formatDate, formatPageCount } from '@/utils/format';

export function documentMeta(doc: ScanDocument): string {
  return `${formatPageCount(doc.pageCount)} · ${formatBytes(doc.sizeBytes)}`;
}

export function documentAccessibilityLabel(doc: ScanDocument): string {
  return `${doc.name}, PDF, ${formatPageCount(doc.pageCount)}, ${formatBytes(doc.sizeBytes)}, modified ${formatDate(doc.updatedAt)}${
    doc.isFavorite ? ', favourite' : ''
  }`;
}
