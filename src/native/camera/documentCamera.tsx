import { requireNativeView } from 'expo';
import type { ComponentType, Ref } from 'react';
import { Platform, type ViewProps } from 'react-native';

import { ScanPilotNative } from '../../../modules/scanpilot-native';

/**
 * ScanPilot's live document camera (Android, CameraX in modules/scanpilot-native).
 * Streams small upright greyscale frames for continuous page detection and
 * takes full-resolution upright photos. `null` where unavailable (iOS, web,
 * builds without the view) — the screen then falls back to expo-camera.
 */
export interface DocumentFrame {
  width: number;
  height: number;
  /** Base64 luma bytes, width × height. */
  gray: string;
}

export interface DocumentCameraHandle {
  takePicture(): Promise<{ uri: string; width: number; height: number }>;
}

export interface DocumentCameraProps extends ViewProps {
  ref?: Ref<DocumentCameraHandle>;
  flash?: 'off' | 'on' | 'auto';
  /** Deliver frames for page detection. */
  analysis?: boolean;
  onCameraReady?: () => void;
  onFrame?: (event: { nativeEvent: DocumentFrame }) => void;
  onCameraError?: (event: { nativeEvent: { message: string } }) => void;
}

function load(): ComponentType<DocumentCameraProps> | null {
  if (Platform.OS !== 'android' || !ScanPilotNative) return null;
  try {
    return requireNativeView<DocumentCameraProps>('ScanPilotNative');
  } catch {
    return null;
  }
}

export const NativeDocumentCamera = load();

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i += 1) t[B64.charCodeAt(i)] = i;
  return t;
})();

/** Fast base64 → bytes (no atob dependency; frames are ~50 KB, 8× per second). */
export function decodeBase64(b64: string): Uint8Array {
  let len = b64.length;
  while (len > 0 && b64[len - 1] === '=') len -= 1;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const a = LOOKUP[b64.charCodeAt(i)];
    const b = LOOKUP[b64.charCodeAt(i + 1)];
    const c = i + 2 < len ? LOOKUP[b64.charCodeAt(i + 2)] : 0;
    const d = i + 3 < len ? LOOKUP[b64.charCodeAt(i + 3)] : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = (n >> 16) & 255;
    if (i + 2 < len) out[o++] = (n >> 8) & 255;
    if (i + 3 < len) out[o++] = n & 255;
  }
  return out;
}
