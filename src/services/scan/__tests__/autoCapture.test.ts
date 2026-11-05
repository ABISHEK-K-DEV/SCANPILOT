import { nextSteady, photoToPreview, quadsClose, STEADY_FRAMES } from '../autoCapture';
import type { Quad } from '../geometry';

const q = (dx = 0): Quad => [
  { x: 100 + dx, y: 100 },
  { x: 900 + dx, y: 110 },
  { x: 880 + dx, y: 1200 },
  { x: 120 + dx, y: 1190 },
];

describe('auto-capture', () => {
  it('treats small corner movement as steady and large as moving', () => {
    expect(quadsClose(q(), q(20), 1600)).toBe(true); // 20 px of 1600
    expect(quadsClose(q(), q(120), 1600)).toBe(false);
  });

  it('counts steady frames and resets when the page is lost or moves', () => {
    let n = nextSteady(null, q(), 0, 1600);
    expect(n).toBe(1);
    n = nextSteady(q(), q(10), n, 1600);
    expect(n).toBe(STEADY_FRAMES);
    expect(nextSteady(q(), q(300), n, 1600)).toBe(1);
    expect(nextSteady(q(), null, n, 1600)).toBe(0);
  });

  it('maps photo coordinates onto a cover-scaled preview', () => {
    // 3000×4000 photo in a 390×600 view: scale = max(0.13, 0.15) = 0.15, x offset = (390 - 450) / 2 = -30.
    const out = photoToPreview([{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }], { width: 3000, height: 4000 }, { width: 390, height: 600 });
    expect(out[0]).toEqual({ x: -30, y: 0 });
    expect(out[2]).toEqual({ x: 420, y: 600 });
  });
});
