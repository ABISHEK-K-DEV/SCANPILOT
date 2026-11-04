/**
 * Compression for scanned/photo PDFs: each page is re-rendered natively at a
 * lower resolution and JPEG quality, then rebuilt page-for-page at the
 * original page size. Honest trade-off (shown in the UI): text in the
 * compressed copy becomes part of the image and is no longer selectable.
 * The original document is always kept.
 */
import { Directory, File } from 'expo-file-system';

import { getPdfRenderer, type PdfPageRenderer } from '@/native/pdfRenderer';
import { createDocumentFromBytes } from '@/services/library/documentService';
import { imagesToPdf } from '@/services/pdf/pdfService';
import type { CancelToken, ImageInput, Progress } from '@/services/pdf/types';
import { readBytes } from '@/services/storage/fileStore';
import { tempDir } from '@/services/storage/paths';
import type { ScanDocument } from '@/types/document';
import { CancelledError, UserFacingError } from '@/utils/errors';
import { createId } from '@/utils/id';

export type CompressionLevel = 'low' | 'medium' | 'high';

export const COMPRESSION_LEVELS: Record<CompressionLevel, { label: string; description: string; dpi: number; quality: number }> = {
  low: { label: 'Low compression', description: 'Best quality · 200 dpi', dpi: 200, quality: 0.8 },
  medium: { label: 'Medium compression', description: 'Recommended · 150 dpi', dpi: 150, quality: 0.65 },
  high: { label: 'High compression', description: 'Smallest file · 110 dpi', dpi: 110, quality: 0.5 },
};

/** Long-edge cap per rendered page, protects low-memory devices from huge page sizes. */
const MAX_EDGE = 3200;
/** pdf-lib container overhead per page plus the document trailer, in bytes (empirical). */
const PAGE_OVERHEAD = 600;
const SAMPLE_PAGES = 3;

export function isCompressionSupported(): boolean {
  return getPdfRenderer() !== null;
}

function requireRenderer(): PdfPageRenderer {
  const renderer = getPdfRenderer();
  if (!renderer) throw new UserFacingError('Compression is not available on this device yet.');
  return renderer;
}

function workDir(): Directory {
  const dir = new Directory(tempDir(), `compress-${createId()}`);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function removeDir(dir: Directory): void {
  try {
    if (dir.exists) dir.delete();
  } catch {
    // Temp is wiped on next cold start anyway.
  }
}

/** Indices of up to `count` pages spread through the document. */
export function samplePageIndices(pageCount: number, count = SAMPLE_PAGES): number[] {
  if (pageCount <= count) return Array.from({ length: pageCount }, (_, i) => i);
  const step = (pageCount - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}

/** Estimated output size from per-page JPEG sizes of a sample. */
export function extrapolateSize(sampleBytes: readonly number[], pageCount: number): number {
  if (sampleBytes.length === 0) return 0;
  const average = sampleBytes.reduce((a, b) => a + b, 0) / sampleBytes.length;
  return Math.round((average + PAGE_OVERHEAD) * pageCount + 1024);
}

export interface Estimate {
  level: CompressionLevel;
  bytes: number;
}

/** Renders a few sample pages at every level to estimate output sizes. */
export async function estimateCompression(doc: ScanDocument): Promise<{ pageCount: number; estimates: Estimate[] }> {
  const renderer = requireRenderer();
  const info = await renderer.getInfo(doc.fileUri);
  const sample = samplePageIndices(info.pageCount);
  const dir = workDir();
  try {
    const estimates: Estimate[] = [];
    for (const level of Object.keys(COMPRESSION_LEVELS) as CompressionLevel[]) {
      const { dpi, quality } = COMPRESSION_LEVELS[level];
      const sizes: number[] = [];
      for (const index of sample) {
        const out = new File(dir, `${level}-${index}.jpg`);
        const page = await renderer.renderPage(doc.fileUri, index, { dpi, quality, maxEdge: MAX_EDGE, outputUri: out.uri });
        sizes.push(page.bytes);
      }
      estimates.push({ level, bytes: extrapolateSize(sizes, info.pageCount) });
    }
    return { pageCount: info.pageCount, estimates };
  } finally {
    removeDir(dir);
  }
}

export interface CompressionResult {
  /** Null when the compressed copy would not be smaller — nothing is saved then. */
  document: ScanDocument | null;
  originalBytes: number;
  compressedBytes: number;
}

export async function compressDocument(
  doc: ScanDocument,
  level: CompressionLevel,
  options: { onProgress?: Progress; cancelToken?: CancelToken } = {},
): Promise<CompressionResult> {
  const renderer = requireRenderer();
  const { dpi, quality } = COMPRESSION_LEVELS[level];
  const info = await renderer.getInfo(doc.fileUri);
  const total = info.pageCount + 1;
  const dir = workDir();
  try {
    const images: ImageInput[] = [];
    for (let i = 0; i < info.pageCount; i += 1) {
      if (options.cancelToken?.cancelled) throw new CancelledError();
      const out = new File(dir, `page-${i}.jpg`);
      const page = await renderer.renderPage(doc.fileUri, i, { dpi, quality, maxEdge: MAX_EDGE, outputUri: out.uri });
      images.push({ bytes: await readBytes(page.uri), mimeType: 'image/jpeg', pageSizePt: { width: page.pageWidth, height: page.pageHeight } });
      out.delete();
      options.onProgress?.(i + 1, total);
    }
    const bytes = await imagesToPdf(images, { title: doc.name, cancelToken: options.cancelToken });
    const originalBytes = doc.sizeBytes;
    if (bytes.length >= originalBytes) {
      options.onProgress?.(total, total);
      return { document: null, originalBytes, compressedBytes: bytes.length };
    }
    const created = await createDocumentFromBytes(bytes, {
      name: `${doc.name} (compressed)`,
      source: 'generated',
      folderId: doc.folderId,
      pageCount: info.pageCount,
    });
    options.onProgress?.(total, total);
    return { document: created, originalBytes, compressedBytes: created.sizeBytes };
  } finally {
    removeDir(dir);
  }
}
