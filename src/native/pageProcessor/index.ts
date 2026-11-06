import { Platform } from 'react-native';

import { ScanPilotNative, type ProcessedScanPage } from '../../../modules/scanpilot-native';

/**
 * Native scan-page pipeline (Android, modules/scanpilot-native PageProcessor.kt):
 * decode → perspective warp → filter → JPEG in compiled code. Returns null where
 * unavailable (iOS, web, tests) so callers fall back to the JS implementation.
 */
export interface NativePageProcessor {
  process(options: {
    input: string;
    quad: number[] | null;
    maxEdge: number;
    filter: string;
    quality: number;
    baseOutput: string | null;
    filteredOutput: string | null;
  }): Promise<ProcessedScanPage>;
}

export function getNativePageProcessor(): NativePageProcessor | null {
  const native = ScanPilotNative;
  if (Platform.OS !== 'android' || !native || typeof native.processScanPage !== 'function') return null;
  return {
    process: (o) => native.processScanPage(o.input, o.quad, o.maxEdge, o.filter, o.quality, o.baseOutput, o.filteredOutput),
  };
}

export type { ProcessedScanPage };
