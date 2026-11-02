import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { deleteIfExists, thumbnailFileFor } from '@/services/storage/fileStore';

const THUMBNAIL_OPTIONS = { quality: 72, maxWidth: 420, maxHeight: 560 } as const;

type PdfThumbnailModule = typeof import('react-native-pdf-thumbnail').default;

let cachedModule: PdfThumbnailModule | null | undefined;

/** Loads the native module lazily so Expo Go / web degrade to icon placeholders. */
function nativeModule(): PdfThumbnailModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (Platform.OS === 'web') {
    cachedModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = (require('react-native-pdf-thumbnail') as { default: PdfThumbnailModule }).default;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/**
 * Renders page 1 of a PDF into a small persistent JPEG (PdfRenderer on
 * Android, PDFKit on iOS). Returns null if rendering is unavailable or fails,
 * e.g. for password-protected files — callers show a placeholder instead.
 */
export async function generateThumbnail(documentId: string, pdfUri: string, previousUri?: string | null): Promise<string | null> {
  const native = nativeModule();
  if (!native) return null;
  try {
    const result = await native.generate(pdfUri, 0, THUMBNAIL_OPTIONS);
    const target = thumbnailFileFor(documentId);
    await new File(result.uri).move(target);
    deleteIfExists(previousUri);
    return target.uri;
  } catch {
    return null;
  }
}
