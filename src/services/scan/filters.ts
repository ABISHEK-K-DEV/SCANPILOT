/**
 * Pure pixel filters for scanned pages (RGBA in, RGBA out, same size).
 * Used by the scan review screen and by secure redaction.
 */
import type { RgbaImage } from './warp';

export type FilterId = 'original' | 'auto' | 'grayscale' | 'bw' | 'contrast' | 'clarity' | 'photo';

export const FILTERS: readonly { id: FilterId; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'auto', label: 'Auto enhance' },
  { id: 'clarity', label: 'Document' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'bw', label: 'Black & white' },
  { id: 'contrast', label: 'High contrast' },
  { id: 'photo', label: 'Photo' },
];

export interface Adjustments {
  /** -1…1 */
  brightness: number;
  /** -1…1 */
  contrast: number;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Low/high luminance percentiles, used for automatic level stretching. */
export function percentiles(img: RgbaImage, low = 0.01, high = 0.99): [number, number] {
  const hist = new Uint32Array(256);
  const d = img.data;
  const step = d.length > 4_000_000 ? 16 : 4; // sample large images
  let count = 0;
  for (let i = 0; i < d.length; i += step) {
    hist[luma(d[i], d[i + 1], d[i + 2]) | 0] += 1;
    count += 1;
  }
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v += 1) {
    acc += hist[v];
    if (acc >= count * low) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v -= 1) {
    acc += hist[v];
    if (acc >= count * (1 - high)) {
      hi = v;
      break;
    }
  }
  return hi - lo < 16 ? [0, 255] : [lo, hi];
}

function mapChannels(img: RgbaImage, fn: (r: number, g: number, b: number, out: Uint8Array, o: number) => void): RgbaImage {
  const out = new Uint8Array(img.data.length);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    fn(d[i], d[i + 1], d[i + 2], out, i);
    out[i + 3] = 255;
  }
  return { width: img.width, height: img.height, data: out };
}

function stretch(img: RgbaImage, boost = 1): RgbaImage {
  const [lo, hi] = percentiles(img);
  const scale = (255 / (hi - lo)) * boost;
  const mid = (lo + hi) / 2;
  return mapChannels(img, (r, g, b, out, o) => {
    out[o] = clamp((r - mid) * scale + 127.5 + (127.5 - mid) * 0);
    out[o + 1] = clamp((g - mid) * scale + 127.5);
    out[o + 2] = clamp((b - mid) * scale + 127.5);
  });
}

/** Box-mean adaptive threshold using an integral image — robust to shadows and uneven light. */
function adaptiveThreshold(img: RgbaImage, windowFraction = 1 / 8, bias = 12): RgbaImage {
  const { width: w, height: h, data: d } = img;
  // Global floor: anything clearly dark is ink, even inside large solid areas (bold headings, logos)
  // where the local mean alone would hollow them out.
  const [lo, hi] = percentiles(img);
  const globalDark = lo + (hi - lo) * 0.35;
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < gray.length; i += 4, p += 1) gray[p] = luma(d[i], d[i + 1], d[i + 2]);
  // Sums stay below 2^32 for images up to ~16 MP of 8-bit values.
  const integral = new Uint32Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= w; x += 1) {
      rowSum += gray[(y - 1) * w + (x - 1)];
      integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + rowSum;
    }
  }
  const r = Math.max(4, Math.round(Math.max(w, h) * windowFraction) >> 1);
  const out = new Uint8Array(d.length);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const g = gray[y * w + x];
      const v = g < globalDark || g < sum / area - bias ? 0 : 255;
      const o = (y * w + x) * 4;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * "Document" look: estimates the paper colour per block from its brightest
 * pixels, interpolates that background smoothly, and divides it out. Removes
 * shadows and paper colour casts, then deepens the ink slightly.
 */
function clarity(img: RgbaImage): RgbaImage {
  const { width: w, height: h, data: d } = img;
  const block = Math.max(8, Math.round(Math.max(w, h) / 28));
  const bw = Math.ceil(w / block);
  const bh = Math.ceil(h / block);
  const bg = new Float32Array(bw * bh * 3);
  for (let by = 0; by < bh; by += 1) {
    for (let bx = 0; bx < bw; bx += 1) {
      // Brightest pixels in the block (by luma) approximate the paper.
      let best = -1;
      let br = 255;
      let bgc = 255;
      let bb = 255;
      const yEnd = Math.min(h, (by + 1) * block);
      const xEnd = Math.min(w, (bx + 1) * block);
      for (let y = by * block; y < yEnd; y += 2) {
        for (let x = bx * block; x < xEnd; x += 2) {
          const o = (y * w + x) * 4;
          const l = d[o] * 3 + d[o + 1] * 6 + d[o + 2];
          if (l > best) {
            best = l;
            br = d[o];
            bgc = d[o + 1];
            bb = d[o + 2];
          }
        }
      }
      const i = (by * bw + bx) * 3;
      bg[i] = Math.max(br, 24);
      bg[i + 1] = Math.max(bgc, 24);
      bg[i + 2] = Math.max(bb, 24);
    }
  }
  // Smooth the block background (3x3 mean) so isolated ink-only blocks don't create halos.
  const smooth = new Float32Array(bg.length);
  for (let by = 0; by < bh; by += 1) {
    for (let bx = 0; bx < bw; bx += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        let max = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const x = bx + dx;
            const y = by + dy;
            if (x < 0 || y < 0 || x >= bw || y >= bh) continue;
            const v = bg[(y * bw + x) * 3 + c];
            sum += v;
            if (v > max) max = v;
            n += 1;
          }
        }
        // Lean towards the brighter neighbour: blocks full of ink under-estimate paper.
        smooth[(by * bw + bx) * 3 + c] = (sum / n) * 0.5 + max * 0.5;
      }
    }
  }
  const out = new Uint8Array(d.length);
  for (let y = 0; y < h; y += 1) {
    const fy = Math.min(bh - 1, Math.max(0, (y + 0.5) / block - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(bh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x += 1) {
      const fx = Math.min(bw - 1, Math.max(0, (x + 0.5) / block - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(bw - 1, x0 + 1);
      const tx = fx - x0;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const a00 = smooth[(y0 * bw + x0) * 3 + c];
        const a10 = smooth[(y0 * bw + x1) * 3 + c];
        const a01 = smooth[(y1 * bw + x0) * 3 + c];
        const a11 = smooth[(y1 * bw + x1) * 3 + c];
        const background = (a00 * (1 - tx) + a10 * tx) * (1 - ty) + (a01 * (1 - tx) + a11 * tx) * ty;
        const t = Math.min(1, d[o + c] / background);
        // Deepen ink, keep paper white: t^1.6 with a small white point lift.
        out[o + c] = clamp(255 * Math.pow(t, 1.6) * 1.04);
      }
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

export function applyFilter(img: RgbaImage, filter: FilterId): RgbaImage {
  switch (filter) {
    case 'auto':
      return stretch(img, 1.05);
    case 'grayscale':
      return mapChannels(img, (r, g, b, out, o) => {
        const v = luma(r, g, b);
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
      });
    case 'bw':
      return adaptiveThreshold(img);
    case 'contrast': {
      const g = mapChannels(img, (r, gg, b, out, o) => {
        const v = luma(r, gg, b);
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
      });
      return stretch(g, 1.35);
    }
    case 'clarity':
      return clarity(img);
    case 'photo': {
      const s = stretch(img, 1.0);
      return mapChannels(s, (r, g, b, out, o) => {
        const v = luma(r, g, b);
        out[o] = clamp(v + (r - v) * 1.25);
        out[o + 1] = clamp(v + (g - v) * 1.25);
        out[o + 2] = clamp(v + (b - v) * 1.25);
      });
    }
    default:
      return { width: img.width, height: img.height, data: new Uint8Array(img.data) };
  }
}

export function adjust(img: RgbaImage, { brightness, contrast }: Adjustments): RgbaImage {
  if (brightness === 0 && contrast === 0) return img;
  const b = brightness * 80;
  const c = Math.tan(((contrast + 1) * Math.PI) / 4); // 0..∞, 1 = unchanged
  return mapChannels(img, (r, g, bl, out, o) => {
    out[o] = clamp((r - 127.5) * c + 127.5 + b);
    out[o + 1] = clamp((g - 127.5) * c + 127.5 + b);
    out[o + 2] = clamp((bl - 127.5) * c + 127.5 + b);
  });
}

/** RGBA → packed RGB (for the BMP hand-off). */
export function toRgb(img: RgbaImage): { width: number; height: number; data: Uint8Array } {
  const out = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, o = 0; i < img.data.length; i += 4, o += 3) {
    out[o] = img.data[i];
    out[o + 1] = img.data[i + 1];
    out[o + 2] = img.data[i + 2];
  }
  return { width: img.width, height: img.height, data: out };
}

/** Fills rectangles (fractions of the image) with solid colour — burns redactions into pixels. */
export function fillRects(img: RgbaImage, rects: readonly { x: number; y: number; width: number; height: number }[], color: [number, number, number] = [0, 0, 0]): RgbaImage {
  const out = new Uint8Array(img.data);
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x * img.width));
    const y0 = Math.max(0, Math.floor(r.y * img.height));
    const x1 = Math.min(img.width, Math.ceil((r.x + r.width) * img.width));
    const y1 = Math.min(img.height, Math.ceil((r.y + r.height) * img.height));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const o = (y * img.width + x) * 4;
        out[o] = color[0];
        out[o + 1] = color[1];
        out[o + 2] = color[2];
        out[o + 3] = 255;
      }
    }
  }
  return { width: img.width, height: img.height, data: out };
}
