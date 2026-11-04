import { ScanPilotNative, type NativePdfInfo, type RenderedPage } from '../../../modules/scanpilot-native';

/**
 * Native PDF page rendering (Android PdfRenderer) at any DPI. Used for
 * compression and page thumbnails in the organiser. Null on platforms where
 * the module is not available yet (iOS, web) — callers must degrade gracefully.
 */
export interface PdfPageRenderer {
  getInfo(uri: string): Promise<NativePdfInfo>;
  renderPage(uri: string, pageIndex: number, options: { dpi: number; quality: number; maxEdge?: number; outputUri: string }): Promise<RenderedPage>;
}

export function getPdfRenderer(): PdfPageRenderer | null {
  const native = ScanPilotNative;
  if (!native) return null;
  return {
    getInfo: (uri) => native.getPdfInfo(uri),
    renderPage: (uri, pageIndex, o) => native.renderPdfPage(uri, pageIndex, o.dpi, Math.round(o.quality * 100), o.maxEdge ?? 0, o.outputUri),
  };
}

export type { NativePdfInfo, RenderedPage };
