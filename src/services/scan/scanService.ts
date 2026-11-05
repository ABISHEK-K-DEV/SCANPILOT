/**
 * Orchestrates scanning: native scanner → session images → PDF in the library.
 */
import { launchImageLibraryAsync } from 'expo-image-picker';

import { getScanner } from '@/native/scanner';
import { createDocumentFromBytes } from '@/services/library/documentService';
import { imagesToPdf } from '@/services/pdf/pdfService';
import type { CancelToken, ImageInput, Progress } from '@/services/pdf/types';
import { readBytes } from '@/services/storage/fileStore';
import type { ScanDocument } from '@/types/document';
import { CancelledError } from '@/utils/errors';

import { cropImage, detectPageQuad, ingestImage } from './pageProcessing';
import { type DocumentPreset, pageSizeForPreset, type ScanPage } from './types';

export interface IngestCallbacks {
  /** Called once the user has finished capturing/picking, before processing starts. */
  onStart?: (total: number) => void;
  onProgress?: Progress;
}

async function ingestAll(uris: string[], deleteSource: boolean, callbacks: IngestCallbacks): Promise<ScanPage[]> {
  callbacks.onStart?.(uris.length);
  const pages: ScanPage[] = [];
  for (let i = 0; i < uris.length; i += 1) {
    pages.push(await ingestImage(uris[i], { deleteSource }));
    callbacks.onProgress?.(i + 1, uris.length);
  }
  return pages;
}

/** Opens the system scanner. Returns null when the user cancels. */
export async function capturePages(options: { maxPages?: number } & IngestCallbacks = {}): Promise<ScanPage[] | null> {
  const result = await getScanner().scan({ maxPages: options.maxPages, quality: 95 });
  if (result.status === 'cancelled') return null;
  const uris = result.pages.map((p) => p.uri).slice(0, options.maxPages ?? result.pages.length);
  // Extra pages (VisionKit cannot limit the count) are discarded by not ingesting them.
  return ingestAll(uris, true, options);
}

/** Adds pages from the photo library (Android Photo Picker / iOS PHPicker — no permission prompt on Android). */
export async function pickPages(options: { single?: boolean } & IngestCallbacks = {}): Promise<ScanPage[] | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: !options.single,
    orderedSelection: true,
    selectionLimit: options.single ? 1 : 0,
    quality: 1,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return ingestAll(
    result.assets.map((a) => a.uri),
    false,
    options,
  );
}

export async function savePagesAsPdf(
  pages: readonly ScanPage[],
  options: { name: string; preset: DocumentPreset; folderId: string | null; onProgress?: Progress; cancelToken?: CancelToken },
): Promise<ScanDocument> {
  const total = pages.length + 1;
  const images: ImageInput[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    if (options.cancelToken?.cancelled) throw new CancelledError();
    images.push({ bytes: await readBytes(pages[i].uri), mimeType: 'image/jpeg' });
    options.onProgress?.(i + 1, total);
  }
  const bytes = await imagesToPdf(images, {
    pageSize: pageSizeForPreset(options.preset),
    margin: options.preset === 'a4' || options.preset === 'letter' ? 18 : 0,
    title: options.name,
    cancelToken: options.cancelToken,
  });
  const doc = await createDocumentFromBytes(bytes, {
    name: options.name,
    source: 'scan',
    folderId: options.folderId,
    pageCount: pages.length,
  });
  options.onProgress?.(total, total);
  return doc;
}

/**
 * Photo from ScanPilot's own camera → session page. The page is found and
 * straightened automatically when it stands out from the background; the
 * untouched photo stays available via "Original" in the crop editor.
 */
export async function processCameraPhoto(uri: string): Promise<ScanPage> {
  const page = await ingestImage(uri, { deleteSource: true });
  try {
    const quad = await detectPageQuad(page);
    if (!quad) return page;
    const straightened = await cropImage(page, quad);
    return { ...page, uri: straightened.uri, width: straightened.width, height: straightened.height };
  } catch {
    return page; // detection is best-effort; the user can still crop by hand
  }
}
