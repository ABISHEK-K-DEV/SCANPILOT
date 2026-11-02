import { listDocuments, getLibraryStats } from '@/db/documentsRepository';
import { getFolder, listFolders } from '@/db/foldersRepository';
import type { DocumentQuery } from '@/types/document';

import { useAsyncQuery } from './useAsyncQuery';

export function useDocuments(query: DocumentQuery) {
  return useAsyncQuery(() => listDocuments(query), JSON.stringify(query));
}

export function useFolders() {
  return useAsyncQuery(listFolders, 'folders');
}

export function useFolder(id: string) {
  return useAsyncQuery(() => getFolder(id), `folder:${id}`);
}

export function useLibraryStats() {
  return useAsyncQuery(getLibraryStats, 'stats');
}
