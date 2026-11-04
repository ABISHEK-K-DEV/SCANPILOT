import { isConvexQuad, type Quad } from './geometry';

/**
 * Lightweight, dependency-free document edge detection for ScanPilot's own
 * camera. Works on a small greyscale preview (≈300 px long edge):
 *
 *  1. Otsu threshold separates the (usually brighter) page from the background.
 *  2. The largest connected bright region not touching most of the border is
 *     taken as the page.
 *  3. Its four extreme points (min/max of x+y and x−y) are the corners.
 *
 * Returns null when no convincing page is found; callers then keep the full
 * frame and the user can drag the corners in the crop editor.
 */
export interface Detection {
  quad: Quad;
  /** Region area ÷ quad area (1 = perfectly quadrilateral page). */
  confidence: number;
  /** Quad area ÷ image area. */
  coverage: number;
}

export function rgbaToGray(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
  }
  return gray;
}

export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * hist[t];
  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t += 1) {
    weightB += hist[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += t * hist[t];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i += 1) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Largest 4-connected component of `mask` (value 1). Returns its pixel indices. */
function largestComponent(mask: Uint8Array, width: number, height: number): Int32Array | null {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  let best: Int32Array | null = null;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    let count = 0;
    const members: number[] = [];
    stack[top++] = start;
    seen[start] = 1;
    while (top > 0) {
      const i = stack[--top];
      members.push(i);
      count += 1;
      const x = i % width;
      const y = (i - x) / width;
      if (x > 0 && mask[i - 1] && !seen[i - 1]) {
        seen[i - 1] = 1;
        stack[top++] = i - 1;
      }
      if (x < width - 1 && mask[i + 1] && !seen[i + 1]) {
        seen[i + 1] = 1;
        stack[top++] = i + 1;
      }
      if (y > 0 && mask[i - width] && !seen[i - width]) {
        seen[i - width] = 1;
        stack[top++] = i - width;
      }
      if (y < height - 1 && mask[i + width] && !seen[i + width]) {
        seen[i + width] = 1;
        stack[top++] = i + width;
      }
    }
    if (!best || count > best.length) best = Int32Array.from(members);
  }
  return best;
}

export function detectDocumentQuad(gray: Uint8Array, width: number, height: number): Detection | null {
  if (width < 16 || height < 16 || gray.length !== width * height) return null;
  const t = otsuThreshold(gray);
  // Require real contrast between page and background.
  let lo = 0;
  let hi = 0;
  let nLo = 0;
  let nHi = 0;
  for (let i = 0; i < gray.length; i += 1) {
    if (gray[i] > t) {
      hi += gray[i];
      nHi += 1;
    } else {
      lo += gray[i];
      nLo += 1;
    }
  }
  if (nLo === 0 || nHi === 0 || hi / nHi - lo / nLo < 28) return null;

  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i += 1) mask[i] = gray[i] > t ? 1 : 0;
  const region = largestComponent(mask, width, height);
  if (!region) return null;

  let minS = Infinity;
  let maxS = -Infinity;
  let minD = Infinity;
  let maxD = -Infinity;
  const corners = { tl: 0, br: 0, tr: 0, bl: 0 };
  for (let k = 0; k < region.length; k += 1) {
    const i = region[k];
    const x = i % width;
    const y = (i - x) / width;
    const s = x + y;
    const d = x - y;
    if (s < minS) {
      minS = s;
      corners.tl = i;
    }
    if (s > maxS) {
      maxS = s;
      corners.br = i;
    }
    if (d > maxD) {
      maxD = d;
      corners.tr = i;
    }
    if (d < minD) {
      minD = d;
      corners.bl = i;
    }
  }
  const pt = (i: number) => {
    const x = i % width;
    return { x: x + 0.5, y: (i - x) / width + 0.5 };
  };
  const quad: Quad = [pt(corners.tl), pt(corners.tr), pt(corners.br), pt(corners.bl)];
  if (!isConvexQuad(quad)) return null;
  const area = quadArea(quad);
  const coverage = area / (width * height);
  const confidence = area > 0 ? Math.min(1, region.length / area) : 0;
  // Too small, basically the whole frame, or not page-shaped → no detection.
  if (coverage < 0.12 || coverage > 0.97 || confidence < 0.82) return null;
  return { quad, confidence, coverage };
}
