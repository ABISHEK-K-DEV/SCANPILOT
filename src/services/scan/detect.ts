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

/** Region method: the page is a bright blob on a darker background. */
function detectByRegion(gray: Uint8Array, width: number, height: number): Detection | null {
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

// ---------------------------------------------------------------------------
// Edge method: for low-contrast scenes (white paper on a light table) where
// no clean bright region exists. Scans inward from each border for the first
// strong brightness edge, fits a straight line per side with RANSAC, and
// intersects the four lines.
// ---------------------------------------------------------------------------

interface Line {
  /** Point on the line and unit direction. */
  px: number;
  py: number;
  dx: number;
  dy: number;
}

function boxBlur(gray: Uint8Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      let n = 0;
      for (let j = -1; j <= 1; j += 1) {
        const yy = y + j;
        if (yy < 0 || yy >= h) continue;
        for (let i = -1; i <= 1; i += 1) {
          const xx = x + i;
          if (xx < 0 || xx >= w) continue;
          sum += gray[yy * w + xx];
          n += 1;
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

function sobel(img: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const gx = img[i - w + 1] + 2 * img[i + 1] + img[i + w + 1] - img[i - w - 1] - 2 * img[i - 1] - img[i + w - 1];
      const gy = img[i + w - 1] + 2 * img[i + w] + img[i + w + 1] - img[i - w - 1] - 2 * img[i - w] - img[i - w + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

/** Deterministic RANSAC line fit (pairs tried in a fixed pattern so results are reproducible). */
function fitLine(points: readonly { x: number; y: number }[], tolerance: number): { line: Line; inliers: number } | null {
  if (points.length < 6) return null;
  let best: { a: number; b: number; count: number } | null = null;
  const n = points.length;
  for (let a = 0; a < n; a += Math.max(1, Math.floor(n / 24))) {
    for (let b = a + Math.max(2, Math.floor(n / 4)); b < n; b += Math.max(1, Math.floor(n / 12))) {
      const p = points[a];
      const q = points[b];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len < 4) continue;
      const nx = -(q.y - p.y) / len;
      const ny = (q.x - p.x) / len;
      let count = 0;
      for (const r of points) if (Math.abs((r.x - p.x) * nx + (r.y - p.y) * ny) <= tolerance) count += 1;
      if (!best || count > best.count) best = { a, b, count };
    }
  }
  if (!best || best.count < Math.max(6, n * 0.45)) return null;
  // Refine with least squares (principal axis) on the inliers.
  const p = points[best.a];
  const q = points[best.b];
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  const nx = -(q.y - p.y) / len;
  const ny = (q.x - p.x) / len;
  const inl = points.filter((r) => Math.abs((r.x - p.x) * nx + (r.y - p.y) * ny) <= tolerance);
  const mx = inl.reduce((s, r) => s + r.x, 0) / inl.length;
  const my = inl.reduce((s, r) => s + r.y, 0) / inl.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const r of inl) {
    sxx += (r.x - mx) ** 2;
    syy += (r.y - my) ** 2;
    sxy += (r.x - mx) * (r.y - my);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { line: { px: mx, py: my, dx: Math.cos(angle), dy: Math.sin(angle) }, inliers: inl.length / n };
}

function intersect(a: Line, b: Line): { x: number; y: number } | null {
  const det = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(det) < 1e-6) return null;
  const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / det;
  return { x: a.px + a.dx * t, y: a.py + a.dy * t };
}

function detectByEdges(gray: Uint8Array, w: number, h: number): Detection | null {
  const mag = sobel(boxBlur(gray, w, h), w, h);
  // Threshold: well above the noise floor (90th percentile), with an absolute minimum.
  const sorted = Float32Array.from(mag).sort();
  const threshold = Math.max(40, sorted[Math.floor(sorted.length * 0.9)]);
  const SAMPLES = 48;
  const sides: { x: number; y: number }[][] = [[], [], [], []]; // top, right, bottom, left
  const reachX = Math.floor(w * 0.45);
  const reachY = Math.floor(h * 0.45);
  for (let k = 0; k < SAMPLES; k += 1) {
    const fx = 0.12 + (0.76 * k) / (SAMPLES - 1);
    const x = Math.round(fx * (w - 1));
    const y = Math.round(fx * (h - 1));
    for (let yy = 2; yy < reachY; yy += 1) if (mag[yy * w + x] > threshold) { sides[0].push({ x, y: yy }); break; }
    for (let xx = w - 3; xx > w - reachX; xx -= 1) if (mag[y * w + xx] > threshold) { sides[1].push({ x: xx, y }); break; }
    for (let yy = h - 3; yy > h - reachY; yy -= 1) if (mag[yy * w + x] > threshold) { sides[2].push({ x, y: yy }); break; }
    for (let xx = 2; xx < reachX; xx += 1) if (mag[y * w + xx] > threshold) { sides[3].push({ x: xx, y }); break; }
  }
  const tol = Math.max(1.5, Math.min(w, h) * 0.012);
  const fits = sides.map((pts) => fitLine(pts, tol));
  if (fits.some((f) => f === null)) return null;
  const [top, right, bottom, left] = fits as { line: Line; inliers: number }[];
  const corners = [intersect(top.line, left.line), intersect(top.line, right.line), intersect(bottom.line, right.line), intersect(bottom.line, left.line)];
  if (corners.some((c) => c === null)) return null;
  const margin = Math.min(w, h) * 0.04;
  const quad = corners.map((c) => ({ x: Math.min(w, Math.max(0, c!.x)), y: Math.min(h, Math.max(0, c!.y)) })) as Quad;
  if (corners.some((c) => c!.x < -margin || c!.y < -margin || c!.x > w + margin || c!.y > h + margin)) return null;
  if (!isConvexQuad(quad)) return null;
  const coverage = quadArea(quad) / (w * h);
  const confidence = (top.inliers + right.inliers + bottom.inliers + left.inliers) / 4;
  if (coverage < 0.15 || coverage > 0.97 || confidence < 0.55) return null;
  return { quad, confidence, coverage };
}

/**
 * Finds the page: the region method first (fast, very reliable on contrasting
 * backgrounds), then the edge method for low-contrast scenes.
 */
export function detectDocumentQuad(gray: Uint8Array, width: number, height: number): Detection | null {
  if (width < 16 || height < 16 || gray.length !== width * height) return null;
  return detectByRegion(gray, width, height) ?? detectByEdges(gray, width, height);
}
