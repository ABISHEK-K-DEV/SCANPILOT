export type Progress = (completed: number, total: number) => void;

/** Minimal cancellation token so long operations can be stopped between pages. */
export interface CancelToken {
  readonly cancelled: boolean;
}

export interface OperationOptions {
  onProgress?: Progress;
  cancelToken?: CancelToken;
}

export type ImagePageSize = 'fit' | 'a4' | 'letter';

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
