import { adjust, applyFilter, fillRects, percentiles, toRgb } from '../filters';
import type { RgbaImage } from '../warp';

/** Grey-ish paper (200) with a dark ink block (60) and a shadow gradient on the right. */
function page(w = 64, h = 64): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const shadow = x > w / 2 ? (x - w / 2) * 2 : 0;
      const ink = x > 10 && x < 20 && y > 10 && y < 50;
      const v = (ink ? 60 : 200) - shadow;
      const o = (y * w + x) * 4;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v + 10;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const at = (img: RgbaImage, x: number, y: number) => img.data[(y * img.width + x) * 4];

describe('filters', () => {
  it('auto enhance stretches levels', () => {
    const [lo, hi] = percentiles(page());
    expect(lo).toBeLessThan(hi);
    const out = applyFilter(page(), 'auto');
    expect(at(out, 5, 5)).toBeGreaterThan(at(page(), 5, 5));
    expect(at(out, 15, 30)).toBeLessThan(at(page(), 15, 30));
  });

  it('black & white keeps ink black and paper white, even in shadow', () => {
    const out = applyFilter(page(), 'bw');
    expect(at(out, 15, 30)).toBe(0);
    expect(at(out, 5, 5)).toBe(255);
    expect(at(out, 60, 30)).toBe(255); // shaded paper stays white
  });

  it('document clarity flattens shadows', () => {
    const out = applyFilter(page(), 'clarity');
    expect(Math.abs(at(out, 5, 5) - at(out, 58, 5))).toBeLessThan(40);
    expect(at(out, 15, 30)).toBeLessThan(at(out, 5, 5));
  });

  it('whiteboard turns the board white (even in shadow) and keeps strokes', () => {
    const out = applyFilter(page(), 'whiteboard');
    expect(at(out, 40, 5)).toBe(255); // board in light
    expect(at(out, 60, 5)).toBe(255); // board in shadow
    expect(at(out, 15, 30)).toBeLessThan(120); // marker stroke
  });

  it('grayscale removes colour; original copies', () => {
    const g = applyFilter(page(), 'grayscale');
    const o = (5 * g.width + 5) * 4;
    expect(g.data[o]).toBe(g.data[o + 2]);
    const orig = applyFilter(page(), 'original');
    expect(orig.data).toEqual(page().data);
    expect(orig.data).not.toBe(page().data);
  });

  it('brightness/contrast adjust', () => {
    expect(at(adjust(page(), { brightness: 0.5, contrast: 0 }), 5, 5)).toBeGreaterThan(200);
    expect(adjust(page(), { brightness: 0, contrast: 0 }).data).toEqual(page().data);
  });

  it('burns redaction boxes into pixels and converts to RGB', () => {
    const red = fillRects(page(), [{ x: 0, y: 0, width: 0.5, height: 0.5 }]);
    expect(at(red, 10, 10)).toBe(0);
    expect(at(red, 50, 50)).not.toBe(0);
    const rgb = toRgb(red);
    expect(rgb.data.length).toBe(64 * 64 * 3);
  });
});
