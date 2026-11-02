import { type Homography, homography, type Quad, type Size } from './geometry';

export interface RgbaImage {
  width: number;
  height: number;
  /** 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

export interface RgbImage {
  width: number;
  height: number;
  /** 3 bytes per pixel, row-major, top-down. */
  data: Uint8Array;
}

/**
 * Perspective-corrects the region `quad` of `src` into an `out`-sized upright
 * image using inverse mapping and bilinear sampling. Pixels outside the source
 * are filled with white (paper colour).
 */
export function warpPerspective(src: RgbaImage, quad: Quad, out: Size): RgbImage {
  const { width: W, height: H } = out;
  const dstQuad: Quad = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];
  // Maps output pixel coordinates → source pixel coordinates.
  const h: Homography = homography(dstQuad, quad);
  const result = new Uint8Array(W * H * 3);
  const sw = src.width;
  const sh = src.height;
  const s = src.data;
  let o = 0;
  const maxX = sw - 1;
  const maxY = sh - 1;
  for (let v = 0; v < H; v += 1) {
    const vy = v + 0.5;
    // Row-constant parts of the projective transform, advanced incrementally per column.
    let nx = h[1] * vy + h[2] + h[0] * 0.5;
    let ny = h[4] * vy + h[5] + h[3] * 0.5;
    let d = h[7] * vy + h[8] + h[6] * 0.5;
    for (let u = 0; u < W; u += 1, o += 3) {
      const inv = 1 / d;
      let x = nx * inv - 0.5;
      let y = ny * inv - 0.5;
      nx += h[0];
      ny += h[3];
      d += h[6];
      if (x < -0.5 || y < -0.5 || x > sw - 0.5 || y > sh - 0.5) {
        result[o] = 255;
        result[o + 1] = 255;
        result[o + 2] = 255;
        continue;
      }
      if (x < 0) x = 0;
      else if (x > maxX) x = maxX;
      if (y < 0) y = 0;
      else if (y > maxY) y = maxY;
      const x0 = x | 0;
      const y0 = y | 0;
      const fx = x - x0;
      const fy = y - y0;
      const dx = x0 < maxX ? 4 : 0;
      const dy = y0 < maxY ? sw * 4 : 0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + dx;
      const i01 = i00 + dy;
      const i11 = i01 + dx;
      const w11 = fx * fy;
      const w10 = fx - w11;
      const w01 = fy - w11;
      const w00 = 1 - fx - fy + w11;
      result[o] = s[i00] * w00 + s[i10] * w10 + s[i01] * w01 + s[i11] * w11 + 0.5;
      result[o + 1] = s[i00 + 1] * w00 + s[i10 + 1] * w10 + s[i01 + 1] * w01 + s[i11 + 1] * w11 + 0.5;
      result[o + 2] = s[i00 + 2] * w00 + s[i10 + 2] * w10 + s[i01 + 2] * w01 + s[i11 + 2] * w11 + 0.5;
    }
  }
  return { width: W, height: H, data: result };
}
