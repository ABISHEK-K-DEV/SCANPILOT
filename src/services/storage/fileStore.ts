import { Directory, File } from 'expo-file-system';

import { createId } from '@/utils/id';

import { documentsDir, libraryRoot, tempDir, thumbnailsDir } from './paths';

function ensureDir(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

/** Creates the library directory tree and clears leftovers from interrupted operations. */
export function initialiseStorage(): void {
  ensureDir(libraryRoot());
  ensureDir(documentsDir());
  ensureDir(thumbnailsDir());
  clearTemp();
}

export function clearTemp(): void {
  const dir = tempDir();
  try {
    if (dir.exists) dir.delete();
  } catch {
    // Best effort — a locked file will be removed on the next launch.
  }
  ensureDir(dir);
}

export function documentFileFor(id: string): File {
  return new File(documentsDir(), `${id}.pdf`);
}

export function thumbnailFileFor(id: string): File {
  // A version suffix busts image caches when a document's first page changes.
  return new File(thumbnailsDir(), `${id}-${Date.now().toString(36)}.jpg`);
}

export function newTempFile(extension: string): File {
  ensureDir(tempDir());
  return new File(tempDir(), `${createId()}.${extension}`);
}

export async function readBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

/** Writes via a temp file then moves into place so a crash never leaves a half-written document. */
export async function writeBytesAtomically(target: File, bytes: Uint8Array): Promise<void> {
  const temp = newTempFile('part');
  temp.create({ overwrite: true });
  await temp.write(bytes);
  if (target.exists) target.delete();
  await temp.move(target);
}

export async function copyInto(sourceUri: string, target: File): Promise<void> {
  const source = new File(sourceUri);
  if (target.exists) target.delete();
  await source.copy(target);
}

export function fileSize(uri: string): number {
  const info = new File(uri).info();
  return info.exists ? info.size ?? 0 : 0;
}

export function deleteIfExists(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone or inaccessible; nothing else to clean up.
  }
}

export interface StorageUsage {
  documentsBytes: number;
  thumbnailsBytes: number;
  tempBytes: number;
}

function dirSize(dir: Directory): number {
  try {
    return dir.exists ? dir.size ?? 0 : 0;
  } catch {
    return 0;
  }
}

export function storageUsage(): StorageUsage {
  return {
    documentsBytes: dirSize(documentsDir()),
    thumbnailsBytes: dirSize(thumbnailsDir()),
    tempBytes: dirSize(tempDir()),
  };
}
