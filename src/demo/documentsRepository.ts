import type { DocumentQuery, ScanDocument } from '@/types/document';

import { demoDocuments } from './data';

const docs = [...demoDocuments];

export async function listDocuments(query: DocumentQuery = {}): Promise<ScanDocument[]> {
  const search = query.search?.trim().toLowerCase();
  let result = docs.filter(
    (d) =>
      (!search || d.name.toLowerCase().includes(search)) &&
      (query.folderId === undefined || d.folderId === query.folderId) &&
      (!query.favoritesOnly || d.isFavorite),
  );
  const sort = query.sort ?? { field: 'date', direction: 'desc' };
  const dir = sort.direction === 'asc' ? 1 : -1;
  result = [...result].sort((a, b) => {
    switch (sort.field) {
      case 'name':
        return dir * a.name.localeCompare(b.name);
      case 'size':
        return dir * (a.sizeBytes - b.sizeBytes);
      case 'opened':
        return (b.lastOpenedAt ?? -1) - (a.lastOpenedAt ?? -1);
      default:
        return dir * (a.updatedAt - b.updatedAt);
    }
  });
  return query.limit ? result.slice(0, query.limit) : result;
}

export async function getDocument(id: string): Promise<ScanDocument | null> {
  return docs.find((d) => d.id === id) ?? null;
}

export async function documentNameExists(name: string, excludeId?: string): Promise<boolean> {
  return docs.some((d) => d.id !== excludeId && d.name.toLowerCase() === name.toLowerCase());
}

export async function allDocumentNames(): Promise<Set<string>> {
  return new Set(docs.map((d) => d.name.toLowerCase()));
}

export async function insertDocument(doc: ScanDocument): Promise<void> {
  docs.unshift(doc);
}

export async function updateDocument(id: string, patch: Partial<ScanDocument>): Promise<void> {
  const index = docs.findIndex((d) => d.id === id);
  if (index >= 0) docs[index] = { ...docs[index], ...patch };
}

export async function deleteDocumentRow(id: string): Promise<void> {
  const index = docs.findIndex((d) => d.id === id);
  if (index >= 0) docs.splice(index, 1);
}

export async function getLibraryStats() {
  return {
    documentCount: docs.length,
    totalBytes: docs.reduce((sum, d) => sum + d.sizeBytes, 0),
    favoriteCount: docs.filter((d) => d.isFavorite).length,
  };
}
