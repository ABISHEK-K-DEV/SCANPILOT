import type { ImagePageSize } from '@/services/pdf/types';

export interface ScanPage {
  id: string;
  /** Current (edited) page image, JPEG in the session directory. */
  uri: string;
  width: number;
  height: number;
  /** The page as first captured/imported — "Reset" returns here. */
  originalUri: string;
  originalWidth: number;
  originalHeight: number;
}

export type DocumentPreset = 'original' | 'a4' | 'letter' | 'receipt' | 'business-card' | 'id-card' | 'book';

export const PRESETS: readonly { id: DocumentPreset; label: string; pageSize: ImagePageSize; hint: string }[] = [
  { id: 'original', label: 'Original', pageSize: 'fit', hint: 'Page matches the scan' },
  { id: 'a4', label: 'A4', pageSize: 'a4', hint: '210 × 297 mm' },
  { id: 'letter', label: 'Letter', pageSize: 'letter', hint: '8.5 × 11 in' },
  { id: 'receipt', label: 'Receipt', pageSize: 'receipt', hint: '80 mm wide' },
  { id: 'business-card', label: 'Business card', pageSize: 'business-card', hint: '85 × 55 mm' },
  { id: 'id-card', label: 'ID card', pageSize: 'id-card', hint: '85.6 × 54 mm' },
  { id: 'book', label: 'Book / notes', pageSize: 'fit', hint: 'Keeps page proportions' },
];

export function pageSizeForPreset(preset: DocumentPreset): ImagePageSize {
  return PRESETS.find((p) => p.id === preset)?.pageSize ?? 'fit';
}
