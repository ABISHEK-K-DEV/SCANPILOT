import type { Folder, FolderWithCount } from '@/types/document';

import { demoDocuments, demoFolders } from './data';

const folders = [...demoFolders];
const withCount = (f: Folder): FolderWithCount => ({ ...f, documentCount: demoDocuments.filter((d) => d.folderId === f.id).length });

export async function listFolders(): Promise<FolderWithCount[]> {
  return folders.map(withCount).sort((a, b) => a.name.localeCompare(b.name));
}
export async function getFolder(id: string): Promise<FolderWithCount | null> {
  const f = folders.find((x) => x.id === id);
  return f ? withCount(f) : null;
}
export async function folderNameExists(name: string, excludeId?: string): Promise<boolean> {
  return folders.some((f) => f.id !== excludeId && f.name.toLowerCase() === name.toLowerCase());
}
export async function insertFolder(folder: Folder): Promise<void> {
  folders.push(folder);
}
export async function renameFolderRow(id: string, name: string): Promise<void> {
  const f = folders.find((x) => x.id === id);
  if (f) f.name = name;
}
export async function deleteFolderRow(id: string): Promise<void> {
  const i = folders.findIndex((x) => x.id === id);
  if (i >= 0) folders.splice(i, 1);
}
