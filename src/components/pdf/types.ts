export interface PdfViewerProps {
  uri: string;
  password?: string;
  onLoadComplete?: (pageCount: number) => void;
  onPageChanged?: (page: number, pageCount: number) => void;
  onPasswordRequired?: (incorrect: boolean) => void;
  onError?: (message: string) => void;
}

export function isPasswordError(message: string): boolean {
  return /password/i.test(message);
}
