import type { Quad } from './geometry';

/**
 * Auto-capture decisions, kept pure so they can be unit-tested:
 * a page counts as "steady" when consecutive detections barely move.
 */
export const STEADY_FRAMES = 2;

/** True when every corner moved less than `fraction` of the image's long edge. */
export function quadsClose(a: Quad, b: Quad, longEdge: number, fraction = 0.035): boolean {
  const limit = longEdge * fraction;
  return a.every((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y) <= limit);
}

/** Next steadiness count after a detection (null = page not found). */
export function nextSteady(previous: Quad | null, current: Quad | null, count: number, longEdge: number): number {
  if (!current) return 0;
  if (previous && quadsClose(previous, current, longEdge)) return count + 1;
  return 1;
}

/**
 * Maps a quad from photo pixels to preview points for a preview that fills
 * the view with "cover" scaling (centred crop), as CameraView does.
 */
export function photoToPreview(quad: Quad, photo: { width: number; height: number }, view: { width: number; height: number }): Quad {
  const scale = Math.max(view.width / photo.width, view.height / photo.height);
  const ox = (view.width - photo.width * scale) / 2;
  const oy = (view.height - photo.height * scale) / 2;
  return quad.map((p) => ({ x: p.x * scale + ox, y: p.y * scale + oy })) as Quad;
}
