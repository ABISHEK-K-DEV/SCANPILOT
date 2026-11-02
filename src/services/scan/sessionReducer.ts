import type { ScanPage } from './types';

/** Pure list operations for the scan review screen (unit-tested). */

export function insertPages(pages: readonly ScanPage[], added: readonly ScanPage[], afterIndex?: number): ScanPage[] {
  const at = afterIndex === undefined ? pages.length : Math.max(0, Math.min(pages.length, afterIndex + 1));
  return [...pages.slice(0, at), ...added, ...pages.slice(at)];
}

export function removePage(pages: readonly ScanPage[], id: string): ScanPage[] {
  return pages.filter((page) => page.id !== id);
}

export function movePage(pages: readonly ScanPage[], id: string, delta: number): ScanPage[] {
  const from = pages.findIndex((page) => page.id === id);
  if (from < 0) return [...pages];
  const to = Math.max(0, Math.min(pages.length - 1, from + delta));
  if (to === from) return [...pages];
  const next = [...pages];
  const [page] = next.splice(from, 1);
  next.splice(to, 0, page);
  return next;
}

export function replacePage(pages: readonly ScanPage[], id: string, update: Partial<ScanPage>): ScanPage[] {
  return pages.map((page) => (page.id === id ? { ...page, ...update, id } : page));
}

/** Which page to select after `removedId` disappears: the next one, else the previous. */
export function selectionAfterRemove(pages: readonly ScanPage[], removedId: string): string | null {
  const index = pages.findIndex((page) => page.id === removedId);
  if (index < 0) return pages[0]?.id ?? null;
  return pages[index + 1]?.id ?? pages[index - 1]?.id ?? null;
}

/** Files referenced by `previous` that no page in `next` uses any more — safe to delete. */
export function orphanedFiles(previous: readonly ScanPage[], next: readonly ScanPage[]): string[] {
  const used = new Set(next.flatMap((page) => [page.uri, page.originalUri]));
  const orphans = new Set<string>();
  for (const page of previous) {
    if (!used.has(page.uri)) orphans.add(page.uri);
    if (!used.has(page.originalUri)) orphans.add(page.originalUri);
  }
  return [...orphans];
}
