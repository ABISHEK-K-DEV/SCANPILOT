import { Directory, File } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Platform } from 'react-native';

import { tempDir } from '@/services/storage/paths';
import type { ScanDocument } from '@/types/document';
import { UserFacingError } from '@/utils/errors';
import { exportFileName } from '@/utils/filename';
import { createId } from '@/utils/id';

/**
 * Copies the document into a uniquely-named temp folder so the receiving app
 * sees a friendly file name (e.g. "Invoice.pdf") rather than an internal id.
 * Temp files are removed on the next cold start.
 */
async function exportCopy(doc: ScanDocument): Promise<File> {
  const dir = new Directory(tempDir(), `share-${createId()}`);
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, exportFileName(doc.name));
  await new File(doc.fileUri).copy(target);
  return target;
}

/** Opens the system share sheet. Nothing is sent anywhere unless the user picks a target. */
export async function shareDocument(doc: ScanDocument): Promise<void> {
  if (!(await isAvailableAsync())) throw new UserFacingError('Sharing is not available on this device.');
  const file = await exportCopy(doc);
  await shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Share ${doc.name}`,
  });
}

export const canSaveToDevice = Platform.OS === 'android';

/**
 * Android: lets the user choose a folder (Storage Access Framework) and writes a copy there.
 * iOS users save through the share sheet's "Save to Files" action instead.
 * Returns false if the user cancels the folder picker.
 */
export async function saveToDevice(doc: ScanDocument): Promise<boolean> {
  if (!canSaveToDevice) {
    await shareDocument(doc);
    return true;
  }
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return false; // picker dismissed
  }
  const target = directory.createFile(exportFileName(doc.name), 'application/pdf');
  await target.write(await new File(doc.fileUri).bytes());
  return true;
}

async function tempExport(name: string, bytes: Uint8Array): Promise<File> {
  const dir = new Directory(tempDir(), `export-${createId()}`);
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, name);
  file.create({ overwrite: true });
  await file.write(bytes);
  return file;
}

/** Shares any generated file (text, Word, ZIP, image) through the system sheet. */
export async function shareBytes(name: string, bytes: Uint8Array, mimeType: string, uti?: string): Promise<void> {
  if (!(await isAvailableAsync())) throw new UserFacingError('Sharing is not available on this device.');
  const file = await tempExport(name, bytes);
  await shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: `Share ${name}` });
}

/** Android: writes bytes into a user-chosen folder. iOS: falls back to the share sheet. Returns false if cancelled. */
export async function saveBytesToDevice(name: string, bytes: Uint8Array, mimeType: string): Promise<boolean> {
  if (!canSaveToDevice) {
    await shareBytes(name, bytes, mimeType);
    return true;
  }
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return false;
  }
  const target = directory.createFile(name, mimeType);
  await target.write(bytes);
  return true;
}

/** Writes several files into one user-chosen folder (Android). Returns the count written, or null if cancelled. */
export async function saveManyToDevice(files: readonly { name: string; bytes: Uint8Array; mimeType: string }[]): Promise<number | null> {
  if (!canSaveToDevice) throw new UserFacingError('Saving to a folder is available on Android. Use Share instead.');
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }
  for (const f of files) {
    const target = directory.createFile(f.name, f.mimeType);
    await target.write(f.bytes);
  }
  return files.length;
}
