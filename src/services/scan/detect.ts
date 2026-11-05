/**
 * Automatic page detection for photos taken with ScanPilot's own camera
 * (Google's scanner does its own). Pure and fast: works on a small preview.
 *
 * Approach: grayscale → Otsu threshold → largest bright connected region →
 * corners from the extreme points along both diagonals. Accepted only when
 * the region is a plausible, mostly-filled convex quadrilateral.
 */
import { isConvexQuad, type Quad } from './geometry';
import type { RgbaImage } from './warp';

export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
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

/** Returns the page quad in the input image's pixel coordinates, or null when unsure. */
export function detectDocumentQuad(img: RgbaImage): Quad | null {
  const { width: w, height: h, data } = img;
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < gray.length; i += 4, p += 1) gray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  const t = otsuThreshold(gray);
  // Bright pixels: candidate paper.
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < gray.length; p += 1) mask[p] = gray[p] > t ? 1 : 0;

  // Largest 4-connected bright component (iterative flood fill).
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let bestLabel = 0;
  let bestSize = 0;
  let current = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || label[start]) continue;
    current += 1;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    label[start] = current;
    while (top > 0) {
      const p = stack[--top];
      size += 1;
      const x = p % w;
      const neighbours = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const n of neighbours) {
        if (n < 0 || n >= mask.length || !mask[n] || label[n]) continue;
        label[n] = current;
        stack[top++] = n;
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = current;
    }
  }
  const area = w * h;
  if (bestLabel === 0 || bestSize < area * 0.12 || bestSize > area * 0.98) return null;

  let tl = { x: 0, y: 0, s: Infinity };
  let br = { x: 0, y: 0, s: -Infinity };
  let tr = { x: 0, y: 0, s: -Infinity };
  let bl = { x: 0, y: 0, s: Infinity };
  for (let p = 0; p < label.length; p += 1) {
    if (label[p] !== bestLabel) continue;
    const x = p % w;
    const y = (p - x) / w;
    if (x + y < tl.s) tl = { x, y, s: x + y };
    if (x + y > br.s) br = { x, y, s: x + y };
    if (x - y > tr.s) tr = { x, y, s: x - y };
    if (x - y < bl.s) bl = { x, y, s: x - y };
  }
  // Pixel centres → edges: push corners half a pixel outwards.
  const quad: Quad = [
    { x: tl.x, y: tl.y },
    { x: tr.x + 1, y: tr.y },
    { x: br.x + 1, y: br.y + 1 },
    { x: bl.x, y: bl.y + 1 },
  ];
  if (!isConvexQuad(quad)) return null;
  const qa = quadArea(quad);
  // The region must fill its quad (a page, not a blob) and the quad must be big enough.
  if (qa < area * 0.12 || bestSize / qa < 0.82) return null;
  return quad;
}
