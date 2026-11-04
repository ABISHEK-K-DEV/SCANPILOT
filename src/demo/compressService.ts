/** Demo stand-in: fixed estimates so the Compress screen can be captured in a browser. */
import type { ScanDocument } from '@/types/document';

export type CompressionLevel = 'low' | 'medium' | 'high';
export const COMPRESSION_LEVELS: Record<CompressionLevel, { label: string; description: string; dpi: number; quality: number }> = {
  low: { label: 'Low compression', description: 'Best quality · 200 dpi', dpi: 200, quality: 0.8 },
  medium: { label: 'Medium compression', description: 'Recommended · 150 dpi', dpi: 150, quality: 0.65 },
  high: { label: 'High compression', description: 'Smallest file · 110 dpi', dpi: 110, quality: 0.5 },
};
export interface Estimate {
  level: CompressionLevel;
  bytes: number;
}
export interface CompressionResult {
  document: ScanDocument | null;
  originalBytes: number;
  compressedBytes: number;
}
export const isCompressionSupported = () => true;
export const samplePageIndices = (n: number) => Array.from({ length: Math.min(n, 3) }, (_, i) => i);
export const extrapolateSize = () => 0;
export async function estimateCompression(doc: ScanDocument) {
  const factors: [CompressionLevel, number][] = [['low', 0.52], ['medium', 0.31], ['high', 0.17]];
  return { pageCount: doc.pageCount ?? 1, estimates: factors.map(([level, f]) => ({ level, bytes: Math.round(doc.sizeBytes * f) })) };
}
export async function compressDocument(doc: ScanDocument): Promise<CompressionResult> {
  return { document: { ...doc, id: `${doc.id}-c`, name: `${doc.name} (compressed)`, sizeBytes: Math.round(doc.sizeBytes * 0.31) }, originalBytes: doc.sizeBytes, compressedBytes: Math.round(doc.sizeBytes * 0.31) };
}
