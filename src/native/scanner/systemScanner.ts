import { Platform } from 'react-native';

import type { DocumentScanner, ScannerAvailability, ScanOptions, ScanResult } from './types';

/**
 * System document scanner via react-native-document-scanner-plugin (MIT):
 *  - Android: Google ML Kit Document Scanner (full mode). Edge detection,
 *    auto-capture, perspective correction, crop adjustment and retakes are
 *    provided by Google Play services; the app needs no CAMERA permission.
 *  - iOS: VisionKit VNDocumentCameraViewController.
 */
type PluginModule = typeof import('react-native-document-scanner-plugin').default;

let plugin: PluginModule | null | undefined;

function loadPlugin(): PluginModule | null {
  if (plugin !== undefined) return plugin;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    plugin = null;
    return null;
  }
  try {
    // Lazy: the TurboModule throws on import when it isn't linked (Expo Go, tests).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    plugin = (require('react-native-document-scanner-plugin') as { default: PluginModule }).default;
  } catch {
    plugin = null;
  }
  return plugin;
}

export class ScannerError extends Error {
  constructor(message: string, readonly reason: 'unavailable' | 'failed') {
    super(message);
    this.name = 'ScannerError';
  }
}

function friendlyError(raw: string): ScannerError {
  if (/play services|google play|module.*(not|un)available|gms/i.test(raw)) {
    return new ScannerError(
      'The camera scanner needs Google Play services, which this device does not provide. You can still add pages from your photos.',
      'unavailable',
    );
  }
  return new ScannerError(`The scanner could not start. ${raw}`.trim(), 'failed');
}

export const systemScanner: DocumentScanner = {
  id: Platform.OS === 'ios' ? 'visionkit' : 'mlkit',

  async availability(): Promise<ScannerAvailability> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return { available: false, reason: 'unsupported-platform' };
    return loadPlugin() ? { available: true } : { available: false, reason: 'not-linked' };
  },

  async scan(options: ScanOptions = {}): Promise<ScanResult> {
    const native = loadPlugin();
    if (!native) throw new ScannerError('The document scanner is not available in this build.', 'unavailable');
    try {
      const response = await native.scanDocument({
        croppedImageQuality: options.quality ?? 95,
        ...(options.maxPages ? { maxNumDocuments: options.maxPages } : {}),
      });
      if (response.status === 'cancel' || !response.scannedImages || response.scannedImages.length === 0) {
        return { status: 'cancelled' };
      }
      return {
        status: 'success',
        pages: response.scannedImages.map((uri) => ({ uri: uri.startsWith('/') ? `file://${uri}` : uri })),
      };
    } catch (error) {
      throw friendlyError(error instanceof Error ? error.message : String(error));
    }
  },
};
