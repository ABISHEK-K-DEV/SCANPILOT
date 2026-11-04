/** Demo stand-in for the native renderer: serves the pre-made sample page images. */
export function getPdfRenderer() {
  return {
    async getInfo(uri: string) {
      const pageCount = Number(/pages=(\d+)/.exec(uri)?.[1] ?? 1);
      return { pageCount, pageSizes: Array.from({ length: pageCount }, () => [595, 842] as [number, number]) };
    },
    async renderPage(uri: string, pageIndex: number) {
      const base = uri.split('?')[0];
      return { uri: `${base}page-${(pageIndex % 2) + 1}.png`, width: 620, height: 877, pageWidth: 595, pageHeight: 842, bytes: 180_000 };
    },
  };
}
