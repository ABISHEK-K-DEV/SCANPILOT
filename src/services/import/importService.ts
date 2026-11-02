/**
 * File import. Uses the system document picker and the Android Photo Picker /
 * iOS PHPicker, neither of which needs broad storage permissions: the app only
 * ever sees the files the user explicitly selects.
 */
import { getDocumentAsync } from 'expo-document-picker';
import { File, FileMode } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { createDocumentFromBytes, createDocumentFromFile } from '@/services/library/documentService';
import { imagesToPdf, isPdf } from '@/services/pdf/pdfService';
import type { CancelToken, ImageInput, Progress } from '@/services/pdf/types';
import { readBytes } from '@/services/storage/fileStore';
import type { ScanDocument } from '@/types/document';
import { CancelledError } from '@/utils/errors';
import { stripExtension, timestampedName } from '@/utils/filename';

/**
 * Long-edge cap for imported photos (~210 dpi on A4): sharp enough for text,
 * while keeping memory use predictable on low-RAM devices.
 */
const MAX_IMAGE_EDGE = 2480;
const JPEG_QUALITY = 0.85;

export interface ImportCallbacks {
  onStart?: (total: number) => void;
  onProgress?: Progress;
  cancelToken?: CancelToken;
  folderId?: string | null;
}

export interface ImportResult {
  imported: ScanDocument[];
  failed: { name: string; reason: string }[];
}

function removeQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cache files are also cleared by the OS; ignore.
  }
}

function readHeader(uri: string): Uint8Array {
  const file = new File(uri);
  const length = Math.min(1024, file.size);
  if (length <= 0) return new Uint8Array(0);
  const handle = file.open(FileMode.ReadOnly);
  try {
    return handle.readBytesSync(length);
  } finally {
    handle.close();
  }
}

/** Opens the system picker for PDFs. Returns null if the user cancels. */
export async function importPdfs(callbacks: ImportCallbacks = {}): Promise<ImportResult | null> {
  const result = await getDocumentAsync({ type: 'application/pdf', multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const { assets } = result;
  callbacks.onStart?.(assets.length);
  const outcome: ImportResult = { imported: [], failed: [] };
  for (let i = 0; i < assets.length; i += 1) {
    if (callbacks.cancelToken?.cancelled) throw new CancelledError();
    const asset = assets[i];
    try {
      if (!isPdf(readHeader(asset.uri))) throw new Error('Not a PDF file.');
      const doc = await createDocumentFromFile(asset.uri, {
        name: stripExtension(asset.name) || 'Imported PDF',
        source: 'import-pdf',
        folderId: callbacks.folderId,
      });
      outcome.imported.push(doc);
    } catch (error) {
      outcome.failed.push({ name: asset.name, reason: error instanceof Error ? error.message : 'Import failed.' });
    } finally {
      removeQuietly(asset.uri); // the picker's cache copy is no longer needed
    }
    callbacks.onProgress?.(i + 1, assets.length);
  }
  return outcome;
}

/** Re-encodes one picked image as a bounded-size JPEG (also converts HEIC/WebP). */
async function normaliseImage(uri: string, width: number, height: number): Promise<ImageInput> {
  const context = ImageManipulator.manipulate(uri);
  const longEdge = Math.max(width, height);
  if (longEdge > MAX_IMAGE_EDGE) {
    context.resize(width >= height ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  try {
    return { bytes: await readBytes(saved.uri), mimeType: 'image/jpeg' };
  } finally {
    removeQuietly(saved.uri);
  }
}

/**
 * Lets the user pick photos and combines them, in selection order, into one PDF.
 * Returns null if the user cancels.
 */
export async function importImagesAsPdf(callbacks: ImportCallbacks = {}): Promise<ScanDocument | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    orderedSelection: true,
    selectionLimit: 0,
    quality: 1,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const { assets } = result;
  // Steps: one per image to normalise + one to build the PDF.
  const total = assets.length + 1;
  callbacks.onStart?.(total);
  const images: ImageInput[] = [];
  for (let i = 0; i < assets.length; i += 1) {
    if (callbacks.cancelToken?.cancelled) throw new CancelledError();
    images.push(await normaliseImage(assets[i].uri, assets[i].width, assets[i].height));
    callbacks.onProgress?.(i + 1, total);
  }
  const name =
    assets.length === 1 && assets[0].fileName ? stripExtension(assets[0].fileName) : timestampedName('Images');
  const bytes = await imagesToPdf(images, { pageSize: 'fit', title: name, cancelToken: callbacks.cancelToken });
  const doc = await createDocumentFromBytes(bytes, {
    name,
    source: 'import-image',
    folderId: callbacks.folderId,
    pageCount: images.length,
  });
  callbacks.onProgress?.(total, total);
  return doc;
}
