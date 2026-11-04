import { loadValue, saveValue } from '@/db/settingsRepository';
import type { Pt, RgbColor } from '@/services/pdf/pdfService';

/** A saved signature: strokes normalised to their bounding box plus its display aspect (w/h). */
export interface SavedSignature {
  id: string;
  strokes: Pt[][];
  aspect: number;
  color: RgbColor;
  createdAt: number;
}

const KEY = 'signatures';
const MAX = 4;

export async function listSignatures(): Promise<SavedSignature[]> {
  return (await loadValue<SavedSignature[]>(KEY)) ?? [];
}

export async function addSignature(sig: SavedSignature): Promise<SavedSignature[]> {
  const next = [sig, ...(await listSignatures())].slice(0, MAX);
  await saveValue(KEY, next);
  return next;
}

export async function removeSignature(id: string): Promise<SavedSignature[]> {
  const next = (await listSignatures()).filter((s) => s.id !== id);
  await saveValue(KEY, next);
  return next;
}
