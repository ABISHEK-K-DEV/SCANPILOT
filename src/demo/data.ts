/** Sample library used only by the screenshot/demo build. */
import type { Folder, ScanDocument } from '@/types/document';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-02T15:20:00').getTime();

const doc = (
  id: string,
  name: string,
  pageCount: number,
  sizeBytes: number,
  ageMs: number,
  extra: Partial<ScanDocument> = {},
): ScanDocument => ({
  id,
  name,
  kind: 'pdf',
  source: 'scan',
  fileUri: `/demo-assets/${id}/?pages=${pageCount}`,
  thumbnailUri: `/demo-assets/${id}/page-1.png`,
  pageCount,
  sizeBytes,
  folderId: null,
  isFavorite: false,
  createdAt: now - ageMs,
  updatedAt: now - ageMs,
  lastOpenedAt: null,
  ...extra,
});

export const demoFolders: Folder[] = [
  { id: 'f-contracts', name: 'Contracts', createdAt: now - 40 * DAY, updatedAt: now - 2 * DAY },
  { id: 'f-receipts', name: 'Receipts', createdAt: now - 30 * DAY, updatedAt: now - DAY },
  { id: 'f-ids', name: 'IDs & certificates', createdAt: now - 20 * DAY, updatedAt: now - 5 * DAY },
];

export const demoDocuments: ScanDocument[] = [
  doc('doc-lease', 'Rental agreement 2026', 12, 2_480_000, 2 * 60 * 60 * 1000, { isFavorite: true, folderId: 'f-contracts', lastOpenedAt: now - 3600_000 }),
  doc('doc-bill', 'Electricity bill – October', 2, 412_000, 5 * 60 * 60 * 1000, { source: 'import-pdf' }),
  doc('doc-receipt', 'Grocery receipt', 1, 186_000, DAY + 2 * 3600_000, { folderId: 'f-receipts' }),
  doc('doc-notes', 'Lecture notes – Physics', 6, 1_320_000, 2 * DAY, { isFavorite: true, lastOpenedAt: now - DAY }),
  doc('doc-id', 'Passport copy', 2, 655_000, 5 * DAY, { folderId: 'f-ids', isFavorite: true }),
  doc('doc-invoice', 'Invoice INV-2048', 1, 248_000, 9 * DAY, { source: 'import-pdf' }),
  doc('doc-card', 'Business card – A. Rao', 1, 92_000, 14 * DAY),
  doc('doc-tax', 'Tax return FY2025', 18, 3_960_000, 40 * DAY, { folderId: 'f-contracts' }),
];
