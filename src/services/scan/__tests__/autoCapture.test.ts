import { choosePictureSize, LIVE_STEADY_FRAMES, nextRearm, nextSteady, REARM_FRAMES, smoothQuad, photoToPreview, quadsClose, STEADY_FRAMES } from '../autoCapture';
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

  it('picks the smallest 4:3 picture size that still covers the page resolution', () => {
    expect(choosePictureSize(['4032x3024', '3264x2448', '2592x1944', '1920x1080', '4000x2250'])).toBe('3264x2448');
    expect(choosePictureSize(['1920x1080', '1280x720'])).toBe('1920x1080'); // nothing big enough: the largest
    expect(choosePictureSize(['3840x2160', '4000x2250'])).toBe('3840x2160'); // no 4:3: smallest big one
    expect(choosePictureSize(['Photo'])).toBeUndefined();
  });

  it('smooths the live outline and needs ~0.7 s of steady frames', () => {
    const a = q();
    const b = q(100);
    const mid = smoothQuad(a, b, 0.5);
    expect(mid[0].x).toBe(150);
    expect(smoothQuad(null, b)).toBe(b);
    expect(LIVE_STEADY_FRAMES).toBeGreaterThanOrEqual(5);
  });

  it('does not re-arm while the same page stays in view (no duplicate pages)', () => {
    const page = q();
    let count = 0;
    // The camera keeps seeing the captured page, with small jitter: never re-arms.
    for (let i = 0; i < 50; i++) count = nextRearm(page, q(i % 2 ? 20 : -20), count, 1200);
    expect(count).toBe(0);
    // The page leaves the frame (or a new one is placed elsewhere): re-arms after REARM_FRAMES.
    for (let i = 0; i < REARM_FRAMES; i++) count = nextRearm(page, i % 2 ? null : q(400), count, 1200);
    expect(count).toBe(REARM_FRAMES);
    // One flicker back to the old page resets it.
    expect(nextRearm(page, q(), 2, 1200)).toBe(0);
  });
});
