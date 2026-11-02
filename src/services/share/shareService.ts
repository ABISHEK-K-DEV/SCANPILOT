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
