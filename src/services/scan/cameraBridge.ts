import type { ScanPage } from './types';

/**
 * Lets non-navigation code (e.g. "Scan" inside a tool) await the result of
 * ScanPilot's camera screen: the caller pushes `/scan/camera?mode=return`,
 * the screen calls `resolveCameraRequest` when the user finishes or leaves.
 */
let pending: ((pages: ScanPage[] | null) => void) | null = null;

export function waitForCameraPages(): Promise<ScanPage[] | null> {
  pending?.(null);
  return new Promise((resolve) => {
    pending = resolve;
  });
}

export function resolveCameraRequest(pages: ScanPage[] | null): void {
  const resolve = pending;
  pending = null;
  resolve?.(pages);
}

export function hasCameraRequest(): boolean {
  return pending !== null;
}
