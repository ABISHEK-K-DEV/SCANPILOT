import type { ScanPage } from '@/services/scan/types';

export const MAX_PAGE_EDGE = 2480;
export function sessionDir() {
  return { uri: '/tmp/' };
}
export function deleteSessionFiles(): void {}
export function deleteFileQuietly(): void {}
export async function ingestImage(uri: string): Promise<ScanPage> {
  return { id: uri, uri, originalUri: uri, width: 1240, height: 1754, originalWidth: 1240, originalHeight: 1754 };
}
export async function rotateImage(page: ScanPage) {
  return { uri: page.uri, width: page.width, height: page.height };
}
export async function cropImage(page: ScanPage) {
  return { uri: page.uri, width: page.width, height: page.height };
}
export async function filterImage(uri: string) {
  return { uri, width: 1240, height: 1754 };
}
export async function autoCropPage(page: ScanPage): Promise<ScanPage> {
  return page;
}
export async function filterPreviews(uri: string, filters: readonly string[]): Promise<Record<string, string>> {
  return Object.fromEntries(filters.map((f) => [f, uri]));
}
