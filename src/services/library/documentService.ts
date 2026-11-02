/**
 * Library operations that coordinate file storage and SQLite metadata.
 * UI code calls these functions; it never touches the file system directly.
 */
import {
  allDocumentNames,
  deleteDocumentRow,
  documentNameExists,
  getDocument,
  insertDocument,
  updateDocument,
} from '@/db/documentsRepository';
import { getPdfInfo } from '@/services/pdf/pdfService';
import { copyInto, deleteIfExists, documentFileFor, fileSize, readBytes, writeBytesAtomically } from '@/services/storage/fileStore';
import { generateThumbnail } from '@/services/thumbnails/thumbnailService';
import { notifyLibraryChanged } from '@/stores/libraryStore';
import type { DocumentSource, ScanDocument } from '@/types/document';
import { UserFacingError } from '@/utils/errors';
import { sanitizeDocumentName, uniqueName, validateName } from '@/utils/filename';
import { createId } from '@/utils/id';

/** Above this size we skip parsing the PDF in JS to count pages; the viewer fills it in later. */
const MAX_JS_PARSE_BYTES = 40 * 1024 * 1024;

export async function availableName(desired: string): Promise<string> {
  const taken = await allDocumentNames();
  return uniqueName(sanitizeDocumentName(desired), (candidate) => taken.has(candidate.toLowerCase()));
}

async function countPages(uri: string, size: number): Promise<number | null> {
  if (size > MAX_JS_PARSE_BYTES) return null;
  try {
    const info = await getPdfInfo(await readBytes(uri));
    return info.pageCount;
  } catch {
    return null;
  }
}

interface CreateOptions {
  name: string;
  source: DocumentSource;
  folderId?: string | null;
}

async function registerDocument(id: string, fileUri: string, options: CreateOptions, pageCount?: number | null): Promise<ScanDocument> {
  const size = fileSize(fileUri);
  const now = Date.now();
  const doc: ScanDocument = {
    id,
    name: await availableName(options.name),
    kind: 'pdf',
    source: options.source,
    fileUri,
    thumbnailUri: null,
    pageCount: pageCount === undefined ? await countPages(fileUri, size) : pageCount,
    sizeBytes: size,
    folderId: options.folderId ?? null,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
  };
  doc.thumbnailUri = await generateThumbnail(id, fileUri);
  try {
    await insertDocument(doc);
  } catch (error) {
    deleteIfExists(fileUri);
    deleteIfExists(doc.thumbnailUri);
    throw error;
  }
  notifyLibraryChanged();
  return doc;
}

/** Saves freshly generated PDF bytes as a new library document. */
export async function createDocumentFromBytes(bytes: Uint8Array, options: CreateOptions & { pageCount?: number }): Promise<ScanDocument> {
  const id = createId();
  const file = documentFileFor(id);
  await writeBytesAtomically(file, bytes);
  return registerDocument(id, file.uri, options, options.pageCount);
}

/** Copies an existing PDF (e.g. from the document picker cache) into the library. */
export async function createDocumentFromFile(sourceUri: string, options: CreateOptions): Promise<ScanDocument> {
  const id = createId();
  const file = documentFileFor(id);
  await copyInto(sourceUri, file);
  return registerDocument(id, file.uri, options);
}

export async function requireDocument(id: string): Promise<ScanDocument> {
  const doc = await getDocument(id);
  if (!doc) throw new UserFacingError('This document no longer exists.');
  return doc;
}

export async function renameDocument(id: string, newName: string): Promise<void> {
  const problem = validateName(newName);
  if (problem) throw new UserFacingError(problem);
  const name = sanitizeDocumentName(newName);
  if (await documentNameExists(name, id)) throw new UserFacingError(`A document named "${name}" already exists.`);
  await updateDocument(id, { name });
  notifyLibraryChanged();
}

export async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
  await updateDocument(id, { isFavorite }, false);
  notifyLibraryChanged();
}

export async function moveToFolder(id: string, folderId: string | null): Promise<void> {
  await updateDocument(id, { folderId }, false);
  notifyLibraryChanged();
}

export async function markOpened(id: string): Promise<void> {
  await updateDocument(id, { lastOpenedAt: Date.now() }, false);
  notifyLibraryChanged();
}

/** Called by the viewer once the native renderer knows the real page count. */
export async function recordPageCount(doc: ScanDocument, pageCount: number): Promise<void> {
  if (doc.pageCount === pageCount) return;
  await updateDocument(doc.id, { pageCount }, false);
  notifyLibraryChanged();
}

/** Documents we already tried (and failed) to thumbnail this session — avoids retry loops. */
const thumbnailAttempts = new Set<string>();

export async function ensureThumbnail(doc: ScanDocument): Promise<void> {
  if (doc.thumbnailUri || thumbnailAttempts.has(doc.id)) return;
  thumbnailAttempts.add(doc.id);
  const thumbnailUri = await generateThumbnail(doc.id, doc.fileUri);
  if (thumbnailUri) {
    await updateDocument(doc.id, { thumbnailUri }, false);
    notifyLibraryChanged();
  }
}

export async function duplicateDocument(id: string): Promise<ScanDocument> {
  const original = await requireDocument(id);
  return createDocumentFromFile(original.fileUri, {
    name: `${original.name} copy`,
    source: original.source,
    folderId: original.folderId,
  });
}

/** Permanently removes the PDF, its thumbnail, and its metadata. */
export async function deleteDocument(id: string): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  await deleteDocumentRow(id);
  deleteIfExists(doc.fileUri);
  deleteIfExists(doc.thumbnailUri);
  notifyLibraryChanged();
}
