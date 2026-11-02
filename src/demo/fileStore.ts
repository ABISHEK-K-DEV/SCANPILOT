export function initialiseStorage(): void {}
export function clearTemp(): void {}
export function storageUsage() {
  return { documentsBytes: 9_553_000, thumbnailsBytes: 412_000, tempBytes: 1_830_000 };
}
export async function readBytes(): Promise<Uint8Array> {
  return new Uint8Array();
}
export function fileSize(): number {
  return 0;
}
export function deleteIfExists(): void {}
export function documentFileFor(id: string) {
  return { uri: `/demo-assets/${id}/` };
}
export function thumbnailFileFor(id: string) {
  return { uri: `/demo-assets/${id}/page-1.png` };
}
export function newTempFile() {
  return { uri: '/tmp' };
}
export async function writeBytesAtomically(): Promise<void> {}
export async function copyInto(): Promise<void> {}
