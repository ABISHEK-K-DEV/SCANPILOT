import { Platform } from 'react-native';

import { ScanPilotNative } from '../../../modules/scanpilot-native';
import type { DocumentScanner, ScannerAvailability, ScanOptions, ScanResult } from './types';

/**
 * System document scanner:
 *  - Android: Google ML Kit Document Scanner through ScanPilot's own Expo module
 *    (modules/scanpilot-native). Edge detection, auto-capture, perspective
 *    correction, crop adjustment and retakes run inside Google Play services;
 *    the app needs no CAMERA permission.
 *  - iOS: VisionKit VNDocumentCameraViewController via react-native-document-scanner-plugin.
 */
type IosPlugin = typeof import('react-native-document-scanner-plugin').default;

let iosPlugin: IosPlugin | null | undefined;

function loadIosPlugin(): IosPlugin | null {
  if (iosPlugin !== undefined) return iosPlugin;
  try {
    // Lazy: the TurboModule throws on import when it isn't linked (Expo Go, tests).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iosPlugin = (require('react-native-document-scanner-plugin') as { default: IosPlugin }).default;
  } catch {
    iosPlugin = null;
  }
  return iosPlugin;
}

export class ScannerError extends Error {
  constructor(message: string, readonly reason: 'unavailable' | 'failed') {
    super(message);
    this.name = 'ScannerError';
  }
}

/** Maps native failures to messages a non-technical user can act on. */
export function friendlyScannerError(raw: string, code?: string): ScannerError {
  if (/download/i.test(raw)) {
    return new ScannerError(
      'Google Play services is still downloading the document scanner. Please try again in a minute (keep the internet on for this one-time download).',
      'failed',
    );
  }
  if (code === 'ERR_SCANNER_UNAVAILABLE' || /play services|google play|unavailable|not available|gms|api.*disconnected/i.test(raw)) {
    return new ScannerError(
      'The camera scanner needs an up-to-date Google Play services. Update it from the Play Store, or add pages from your photos instead.',
      'unavailable',
    );
  }
  if (code === 'ERR_SCAN_IN_PROGRESS') return new ScannerError('A scan is already open.', 'failed');
  return new ScannerError(`The scanner could not start. ${raw}`.trim(), 'failed');
}

function errorParts(error: unknown): { message: string; code?: string } {
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; code?: unknown };
    return { message: typeof e.message === 'string' ? e.message : String(error), code: typeof e.code === 'string' ? e.code : undefined };
  }
  return { message: String(error) };
}

export const systemScanner: DocumentScanner = {
  id: Platform.OS === 'ios' ? 'visionkit' : 'mlkit',

  async availability(): Promise<ScannerAvailability> {
    if (Platform.OS === 'android') return ScanPilotNative ? { available: true } : { available: false, reason: 'not-linked' };
    if (Platform.OS === 'ios') return loadIosPlugin() ? { available: true } : { available: false, reason: 'not-linked' };
    return { available: false, reason: 'unsupported-platform' };
  },

  async scan(options: ScanOptions = {}): Promise<ScanResult> {
    try {
      if (Platform.OS === 'android') {
        if (!ScanPilotNative) throw new ScannerError('The document scanner is not available in this build.', 'unavailable');
        const result = await ScanPilotNative.scanDocument({ pageLimit: options.maxPages ?? 0, galleryImport: true, mode: 'base' });
        if (result.status !== 'success' || result.pages.length === 0) return { status: 'cancelled' };
        return { status: 'success', pages: result.pages.map((uri) => ({ uri })) };
      }
      const plugin = Platform.OS === 'ios' ? loadIosPlugin() : null;
      if (!plugin) throw new ScannerError('The document scanner is not available on this device.', 'unavailable');
      const response = await plugin.scanDocument({ croppedImageQuality: options.quality ?? 95 });
      if (response.status === 'cancel' || !response.scannedImages || response.scannedImages.length === 0) {
        return { status: 'cancelled' };
      }
      return {
        status: 'success',
        pages: response.scannedImages.map((uri) => ({ uri: uri.startsWith('/') ? `file://${uri}` : uri })),
      };
    } catch (error) {
      if (error instanceof ScannerError) throw error;
      const { message, code } = errorParts(error);
      throw friendlyScannerError(message, code);
    }
  },
};
