import { systemScanner } from './systemScanner';
import type { DocumentScanner } from './types';

export { ScannerError } from './systemScanner';
export type * from './types';

/** The scanner implementation for this device. Swap here to add the VisionCamera fallback. */
export function getScanner(): DocumentScanner {
  return systemScanner;
}
