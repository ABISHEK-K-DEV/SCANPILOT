export type DocumentKind = 'pdf';

export type DocumentSource = 'import-pdf' | 'import-image' | 'scan' | 'generated';

/** Metadata row for a document stored in the local library. */
export interface ScanDocument {
  id: string;
  /** Display name without the `.pdf` extension. */
  name: string;
  kind: DocumentKind;
  source: DocumentSource;
  /** file:// URI inside the app's private document directory. */
  fileUri: string;
  /** file:// URI of the cached first-page thumbnail, if one was generated. */
  thumbnailUri: string | null;
  /** Null when the page count is not known yet (e.g. very large files). */
  pageCount: number | null;
  sizeBytes: number;
  folderId: string | null;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface FolderWithCount extends Folder {
  documentCount: number;
}

export type SortField = 'name' | 'date' | 'size' | 'opened';
export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  direction: SortDirection;
}

export type ViewMode = 'grid' | 'list';

export interface DocumentQuery {
  search?: string;
  /** `undefined` = any folder, `null` = root (unfiled) only. */
  folderId?: string | null;
  favoritesOnly?: boolean;
  sort?: SortOption;
  limit?: number;
}
