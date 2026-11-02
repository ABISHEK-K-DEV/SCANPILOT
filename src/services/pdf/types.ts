export type Progress = (completed: number, total: number) => void;

/** Minimal cancellation token so long operations can be stopped between pages. */
export interface CancelToken {
  readonly cancelled: boolean;
}

export interface OperationOptions {
  onProgress?: Progress;
  cancelToken?: CancelToken;
}

/**
 * - `fit`: page matches the image aspect ratio (long edge ≈ A4 length).
 * - `a4` / `letter`: standard paper, orientation follows the image, image centred.
 * - `receipt`: 80 mm wide, height follows the image.
 * - `business-card`: 85 × 55 mm; `id-card`: ISO/IEC 7810 ID-1, 85.6 × 53.98 mm.
 */
export type ImagePageSize = 'fit' | 'a4' | 'letter' | 'receipt' | 'business-card' | 'id-card';

export interface ImageInput {
  bytes: Uint8Array;
  /** Optional hint; detected from magic bytes when omitted. */
  mimeType?: 'image/jpeg' | 'image/png';
}

export interface ImagesToPdfOptions extends OperationOptions {
  pageSize?: ImagePageSize;
  /** Margin in PDF points, only used for fixed page sizes. */
  margin?: number;
  title?: string;
}

export type RotationDelta = 90 | -90 | 180;

export interface PdfInfo {
  pageCount: number;
  isEncrypted: boolean;
  title: string | null;
}
