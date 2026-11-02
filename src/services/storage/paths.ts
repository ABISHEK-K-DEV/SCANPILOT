import { Directory, Paths } from 'expo-file-system';

import { relativeTo, resolveFrom } from './pathUtils';

/**
 * All library files live in the app's private document directory, which is
 * not visible to other apps and is excluded from the media scanner.
 *
 * The database stores paths *relative* to this root because the absolute
 * container path can change between app updates on iOS.
 */
const LIBRARY_ROOT = 'ScanPilot';

export function libraryRoot(): Directory {
  return new Directory(Paths.document, LIBRARY_ROOT);
}

export function documentsDir(): Directory {
  return new Directory(libraryRoot(), 'documents');
}

export function thumbnailsDir(): Directory {
  return new Directory(libraryRoot(), 'thumbnails');
}

/** Scratch space for in-progress work; wiped on every cold start. */
export function tempDir(): Directory {
  return new Directory(Paths.cache, 'scanpilot-tmp');
}

export function toLibraryPath(uri: string): string {
  return relativeTo(libraryRoot().uri, uri);
}

export function fromLibraryPath(path: string): string {
  return resolveFrom(libraryRoot().uri, path);
}
