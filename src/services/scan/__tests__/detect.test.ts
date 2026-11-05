import { detectDocumentQuad, otsuThreshold } from '../detect';
import type { RgbaImage } from '../warp';

/** Dark background with a bright convex quad (the "paper"), optionally with dark text lines on it. */
function photo(w: number, h: number, quad: [number, number][], text = true): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < 4; i += 1) {
      const [x1, y1] = quad[i];
      const [x2, y2] = quad[(i + 1) % 4];
      const c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
      const s = Math.sign(c);
      if (s === 0) continue;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4;
      let v = 70 + ((x * 7 + y * 3) % 20); // textured desk
      if (inside(x + 0.5, y + 0.5)) v = text && y % 12 === 6 && x % 40 < 28 ? 40 : 235;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

describe('detectDocumentQuad', () => {
  it('finds the corners of a skewed page (within a few pixels)', () => {
    const corners: [number, number][] = [
      [60, 50],
      [250, 30],
      [270, 380],
      [40, 400],
    ];
    const q = detectDocumentQuad(photo(320, 440, corners));
    expect(q).not.toBeNull();
    q?.forEach((p, i) => {
      expect(Math.abs(p.x - corners[i][0])).toBeLessThan(6);
      expect(Math.abs(p.y - corners[i][1])).toBeLessThan(6);
    });
  });

  it('returns null when there is no page (uniform scene)', () => {
    const blank = photo(200, 200, [[0, 0], [1, 0], [1, 1], [0, 1]], false);
    expect(detectDocumentQuad(blank)).toBeNull();
  });

  it('returns null when the page fills the whole frame (nothing to crop)', () => {
    const full = photo(100, 140, [[-5, -5], [105, -5], [105, 145], [-5, 145]], false);
    expect(detectDocumentQuad(full)).toBeNull();
  });

  it('computes an Otsu threshold between two populations', () => {
    const g = new Uint8Array([...new Array(50).fill(40), ...new Array(50).fill(220)]);
    const t = otsuThreshold(g);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(220);
  });
});
