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

export interface OcrLine {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrResult {
  text: string;
  width: number;
  height: number;
  lines: OcrLine[];
}

interface ScanPilotNativeModule {
  recognizeText(uri: string, script: 'latin' | 'devanagari'): Promise<OcrResult>;
  scanDocument(options: { pageLimit?: number; galleryImport?: boolean; mode?: 'base' | 'full' }): Promise<NativeScanResult>;
  getPdfInfo(uri: string): Promise<NativePdfInfo>;
  renderPdfPage(uri: string, pageIndex: number, dpi: number, quality: number, maxEdge: number, outputUri: string): Promise<RenderedPage>;
}

/** Null when not linked (iOS, web, Expo Go, Jest). */
export const ScanPilotNative = requireOptionalNativeModule<ScanPilotNativeModule>('ScanPilotNative');
