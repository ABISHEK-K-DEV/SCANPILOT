import { deleteFolderRow, folderNameExists, insertFolder, listFolders, renameFolderRow, setFolderLockedRow } from '@/db/foldersRepository';
import { notifyLibraryChanged } from '@/stores/libraryStore';
import type { Folder } from '@/types/document';
import { UserFacingError } from '@/utils/errors';
import { sanitizeDocumentName, validateName } from '@/utils/filename';
import { createId } from '@/utils/id';

async function checkedName(input: string, excludeId?: string): Promise<string> {
  const problem = validateName(input);
  if (problem) throw new UserFacingError(problem);
  const name = sanitizeDocumentName(input);
  if (await folderNameExists(name, excludeId)) throw new UserFacingError(`A folder named "${name}" already exists.`);
  return name;
}

export async function createFolder(input: string): Promise<Folder> {
  const now = Date.now();
  const folder: Folder = { id: createId(), name: await checkedName(input), createdAt: now, updatedAt: now };
  await insertFolder(folder);
  notifyLibraryChanged();
  return folder;
}

export async function renameFolder(id: string, input: string): Promise<void> {
  await renameFolderRow(id, await checkedName(input, id));
  notifyLibraryChanged();
}

/** Deletes the folder only; its documents are kept and moved to "All documents". */
export async function deleteFolder(id: string): Promise<void> {
  await deleteFolderRow(id);
  notifyLibraryChanged();
}

export async function setFolderLocked(id: string, locked: boolean): Promise<void> {
  await setFolderLockedRow(id, locked);
  notifyLibraryChanged();
}

/** Returns the id of the locked folder, creating "Locked" if none exists yet. */
export async function ensureLockedFolder(): Promise<string> {
  const existing = (await listFolders()).find((f) => f.isLocked);
  if (existing) return existing.id;
  const name = (await folderNameExists('Locked')) ? 'Locked folder' : 'Locked';
  const now = Date.now();
  const folder: Folder = { id: createId(), name, createdAt: now, updatedAt: now, isLocked: true };
  await insertFolder(folder);
  notifyLibraryChanged();
  return folder.id;
}
