/** Thin orchestration for single-step PDF tools: read → transform → save as a new document. */
import { createDocumentFromBytes } from '@/services/library/documentService';
import {
  addPageNumbers,
  addWatermark,
  cropPages,
  type PageNumberOptions,
  protectPdf,
  type ProtectOptions,
  repairPdf,
  rotatePages,
  unlockPdf,
  type WatermarkOptions,
} from '@/services/pdf/pdfService';
import type { Margins } from '@/services/pdf/pageGeometry';
import type { RotationDelta } from '@/services/pdf/types';
import { readBytes } from '@/services/storage/fileStore';
import type { ScanDocument } from '@/types/document';

async function transform(doc: ScanDocument, suffix: string, fn: (bytes: Uint8Array) => Promise<Uint8Array>, pageCount = doc.pageCount ?? undefined) {
  const bytes = await fn(await readBytes(doc.fileUri));
  return createDocumentFromBytes(bytes, { name: `${doc.name} (${suffix})`, source: 'generated', folderId: doc.folderId, pageCount });
}

export const watermarkDocument = (doc: ScanDocument, o: WatermarkOptions) => transform(doc, 'watermarked', (b) => addWatermark(b, o));
export const numberDocument = (doc: ScanDocument, o: PageNumberOptions) => transform(doc, 'numbered', (b) => addPageNumbers(b, o));
export const protectDocument = (doc: ScanDocument, o: ProtectOptions) => transform(doc, 'protected', (b) => protectPdf(b, o));
export const unlockDocument = (doc: ScanDocument, password: string) => transform(doc, 'unlocked', (b) => unlockPdf(b, password));
export const rotateDocument = (doc: ScanDocument, delta: RotationDelta) => transform(doc, 'rotated', (b) => rotatePages(b, delta));
export const cropDocument = (doc: ScanDocument, margins: Margins, pages?: number[]) => transform(doc, 'cropped', (b) => cropPages(b, margins, pages));

export async function repairDocument(doc: ScanDocument) {
  const { bytes, pageCount } = await repairPdf(await readBytes(doc.fileUri));
  return createDocumentFromBytes(bytes, { name: `${doc.name} (repaired)`, source: 'generated', folderId: doc.folderId, pageCount });
}
