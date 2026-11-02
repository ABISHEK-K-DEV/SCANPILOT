/**
 * Pure geometry for the crop editor and perspective correction.
 * Quads are ordered top-left, top-right, bottom-right, bottom-left in image pixels.
 */
export interface Point {
  x: number;
  y: number;
}

export type Quad = [Point, Point, Point, Point];

export interface Size {
  width: number;
  height: number;
}

export function fullQuad({ width, height }: Size): Quad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

/** A quad inset by `fraction` of each dimension — a sensible starting crop for photos. */
export function insetQuad(size: Size, fraction: number): Quad {
  const dx = size.width * fraction;
  const dy = size.height * fraction;
  return [
    { x: dx, y: dy },
    { x: size.width - dx, y: dy },
    { x: size.width - dx, y: size.height - dy },
    { x: dx, y: size.height - dy },
  ];
}

export function clampPoint(p: Point, size: Size): Point {
  return { x: Math.min(size.width, Math.max(0, p.x)), y: Math.min(size.height, Math.max(0, p.y)) };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Orders four arbitrary points as TL, TR, BR, BL (by sum / difference of coordinates). */
export function orderQuad(points: readonly Point[]): Quad {
  if (points.length !== 4) throw new Error('A quad needs exactly four points.');
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** True when the quad is strictly convex and not self-intersecting. */
export function isConvexQuad(quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const c = cross(quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]);
    if (Math.abs(c) < 1e-6) return false;
    const s = Math.sign(c);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** True when the quad is an axis-aligned rectangle (within `tolerance` px) — cropping needs no warp. */
export function isAxisAlignedRect(quad: Quad, tolerance = 1): boolean {
  const [tl, tr, br, bl] = quad;
  return (
    Math.abs(tl.y - tr.y) <= tolerance &&
    Math.abs(bl.y - br.y) <= tolerance &&
    Math.abs(tl.x - bl.x) <= tolerance &&
    Math.abs(tr.x - br.x) <= tolerance
  );
}

export function boundingRect(quad: Quad): { x: number; y: number; width: number; height: number } {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Output size for a corrected page: the average lengths of opposite edges,
 * scaled down so the long edge is at most `maxEdge`.
 */
export function outputSizeForQuad(quad: Quad, maxEdge: number): Size {
  const [tl, tr, br, bl] = quad;
  let width = (distance(tl, tr) + distance(bl, br)) / 2;
  let height = (distance(tl, bl) + distance(tr, br)) / 2;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  return { width, height };
}

/** Solves A·x = b for an n×n system with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) throw new Error('Degenerate quad: corners must not be collinear.');
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c += 1) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** 3×3 homography (row-major, h[8] = 1) mapping each `from` point onto the matching `to` point. */
export type Homography = [number, number, number, number, number, number, number, number, number];

export function homography(from: Quad, to: Quad): Homography {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x: u, y: v } = from[i];
    const { x, y } = to[i];
    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    a.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  const h = solve(a, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** Maps a quad expressed in one coordinate space (e.g. on-screen) to another (image pixels). */
export function scaleQuad(quad: Quad, sx: number, sy: number, ox = 0, oy = 0): Quad {
  return quad.map((p) => ({ x: (p.x - ox) * sx, y: (p.y - oy) * sy })) as Quad;
}
