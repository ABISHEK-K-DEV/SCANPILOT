import { requireOptionalNativeModule } from 'expo';

export interface NativeScanResult {
  status: 'success' | 'cancel';
  pages: string[];
}

export interface RenderedPage {
  uri: string;
  width: number;
  height: number;
  /** Page size in PDF points (1/72 in) as rendered, i.e. after /Rotate. */
  pageWidth: number;
  pageHeight: number;
  bytes: number;
}

export interface NativePdfInfo {
  pageCount: number;
  /** [width, height] in points per page. */
  pageSizes: [number, number][];
}

interface ScanPilotNativeModule {
  scanDocument(options: { pageLimit?: number; galleryImport?: boolean }): Promise<NativeScanResult>;
  getPdfInfo(uri: string): Promise<NativePdfInfo>;
  renderPdfPage(uri: string, pageIndex: number, dpi: number, quality: number, maxEdge: number, outputUri: string): Promise<RenderedPage>;
}

/** Null when not linked (iOS, web, Expo Go, Jest). */
export const ScanPilotNative = requireOptionalNativeModule<ScanPilotNativeModule>('ScanPilotNative');
