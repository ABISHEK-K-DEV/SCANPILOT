import type { FilterId } from './filters';
import type { DocumentPreset } from './types';

/**
 * Capture modes of ScanPilot's camera. Each mode sets the frame guide, the
 * default filter and page size, and any extra processing:
 *  - book: splits a two-page spread into left and right pages
 *  - id-card: captures front then back and saves both on one A4 page
 *  - business-card: reads the card and offers to save it as a contact
 */
export type ScanMode = 'document' | 'whiteboard' | 'book' | 'id-card' | 'business-card';

export interface ScanModeDefinition {
  id: ScanMode;
  label: string;
  /** Short hint shown over the camera preview. */
  hint: string;
  /** Frame guide width ÷ height. */
  aspect: number;
  filter: FilterId;
  preset: DocumentPreset;
  /** Pages to capture before finishing automatically (0 = unlimited). */
  autoFinishAfter: number;
  namePrefix: string;
}

export const SCAN_MODES: readonly ScanModeDefinition[] = [
  { id: 'whiteboard', label: 'Whiteboard', hint: 'Fit the whole board in the frame', aspect: 4 / 3, filter: 'whiteboard', preset: 'original', autoFinishAfter: 0, namePrefix: 'Whiteboard' },
  { id: 'book', label: 'Book', hint: 'Fit both open pages in the frame', aspect: 1.42, filter: 'clarity', preset: 'original', autoFinishAfter: 0, namePrefix: 'Book' },
  { id: 'document', label: 'Document', hint: 'Fit the page inside the frame', aspect: 0.72, filter: 'auto', preset: 'original', autoFinishAfter: 0, namePrefix: 'Scan' },
  { id: 'id-card', label: 'ID card', hint: 'Front of the card', aspect: 1.585, filter: 'photo', preset: 'a4', autoFinishAfter: 2, namePrefix: 'ID card' },
  { id: 'business-card', label: 'Business card', hint: 'Fit the card inside the frame', aspect: 1.65, filter: 'auto', preset: 'business-card', autoFinishAfter: 0, namePrefix: 'Business card' },
];

export function scanMode(id: ScanMode): ScanModeDefinition {
  return SCAN_MODES.find((m) => m.id === id) ?? SCAN_MODES[2];
}

/** Hint for the next capture (ID cards alternate front/back). */
export function captureHint(mode: ScanMode, captured: number): string {
  if (mode === 'id-card') return captured === 0 ? 'Front of the card' : 'Now the back of the card';
  return scanMode(mode).hint;
}
