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

/**
 * Picks the camera picture size: the smallest one whose long edge still covers
 * `minLongEdge` (pages are stored at ~2480 px), preferring 4:3. Smaller frames
 * make every snapshot — and so auto-capture — noticeably faster on mid-range
 * phones without lowering the saved page quality. Returns undefined to keep
 * the camera default when nothing parses.
 */
export function choosePictureSize(sizes: readonly string[], minLongEdge = 2600): string | undefined {
  const parsed = sizes
    .map((s) => {
      const m = /^(\d+)\s*x\s*(\d+)$/i.exec(s.trim());
      return m ? { s, w: Number(m[1]), h: Number(m[2]) } : null;
    })
    .filter((x): x is { s: string; w: number; h: number } => x !== null);
  if (parsed.length === 0) return undefined;
  const long = (x: { w: number; h: number }) => Math.max(x.w, x.h);
  const ratio = (x: { w: number; h: number }) => long(x) / Math.min(x.w, x.h);
  const big = parsed.filter((x) => long(x) >= minLongEdge);
  if (big.length === 0) return parsed.sort((a, b) => long(b) - long(a))[0].s;
  const fourThree = big.filter((x) => Math.abs(ratio(x) - 4 / 3) < 0.04);
  const pool = fourThree.length > 0 ? fourThree : big;
  return pool.sort((a, b) => a.w * a.h - b.w * b.h)[0].s;
}
