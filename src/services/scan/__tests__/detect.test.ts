import { detectDocumentQuad, otsuThreshold, rgbaToGray } from '../detect';
import type { Point } from '../geometry';

/** Paints a filled convex polygon (bright paper) onto a dark, noisy background. */
function scene(width: number, height: number, poly: Point[], paper = 225, background = 60): Uint8Array {
  const gray = new Uint8Array(width * height);
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 21) - 10;
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      const s = Math.sign(cross);
      if (s !== 0) {
        if (sign === 0) sign = s;
        else if (s !== sign) return false;
      }
    }
    return true;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      gray[y * width + x] = Math.max(0, Math.min(255, (inside(x + 0.5, y + 0.5) ? paper : background) + noise()));
    }
  }
  return gray;
}

const near = (a: Point, b: Point, tol: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;

describe('document edge detection', () => {
  it('finds the corners of a tilted page', () => {
    const corners = [
      { x: 52, y: 38 },
      { x: 196, y: 56 },
      { x: 180, y: 262 },
      { x: 34, y: 240 },
    ];
    const result = detectDocumentQuad(scene(240, 300, corners), 240, 300);
    expect(result).not.toBeNull();
    result!.quad.forEach((p, i) => expect(near(p, corners[i], 4)).toBe(true));
    expect(result!.confidence).toBeGreaterThan(0.9);
  });

  it('finds an upright page', () => {
    const corners = [
      { x: 30, y: 30 },
      { x: 210, y: 30 },
      { x: 210, y: 270 },
      { x: 30, y: 270 },
    ];
    const result = detectDocumentQuad(scene(240, 300, corners), 240, 300);
    expect(result).not.toBeNull();
    result!.quad.forEach((p, i) => expect(near(p, corners[i], 3)).toBe(true));
  });

  it('returns null for a blank frame', () => {
    const flat = new Uint8Array(200 * 200).fill(128);
    expect(detectDocumentQuad(flat, 200, 200)).toBeNull();
  });

  it('returns null when the page is tiny', () => {
    const corners = [
      { x: 100, y: 100 },
      { x: 120, y: 100 },
      { x: 120, y: 125 },
      { x: 100, y: 125 },
    ];
    expect(detectDocumentQuad(scene(240, 300, corners), 240, 300)).toBeNull();
  });

  it('computes a threshold between two populations and converts RGBA to grey', () => {
    const gray = new Uint8Array([...Array(50).fill(40), ...Array(50).fill(200)]);
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(200);
    expect(Array.from(rgbaToGray(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1))).toEqual([255, 0]);
  });
});
