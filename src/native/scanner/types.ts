/**
 * Contract between UI and the native document scanner (implemented in Milestone 2).
 *
 * Native scanning code lives behind this interface so screens never import a
 * scanner SDK directly. Planned implementations:
 *  - `mlkitScanner` (Android): Google ML Kit Document Scanner via
 *    react-native-document-scanner-plugin — edge detection, auto-capture,
 *    perspective correction and cropping, without the CAMERA permission.
 *  - `visionKitScanner` (iOS): VNDocumentCameraViewController via the same plugin.
 *  - `cameraScanner` (fallback, optional): VisionCamera + OpenCV for devices
 *    without Google Play services.
 */
export type ScannerAvailability =
  | { available: true }
  | { available: false; reason: 'unsupported-platform' | 'missing-play-services' | 'not-linked' };

export interface ScanOptions {
  /** Upper bound on pages captured in one session (the user can stop earlier). */
  maxPages?: number;
  /** JPEG quality 0–100 for the cropped page images. */
  quality?: number;
}

export interface ScannedPage {
  /** file:// URI of the perspective-corrected page image in the cache directory. */
  uri: string;
  width?: number;
  height?: number;
}

export type ScanResult = { status: 'success'; pages: ScannedPage[] } | { status: 'cancelled' };

export interface DocumentScanner {
  readonly id: string;
  availability(): Promise<ScannerAvailability>;
  scan(options?: ScanOptions): Promise<ScanResult>;
}
