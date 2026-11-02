import {
  applyHomography,
  boundingRect,
  fullQuad,
  homography,
  insetQuad,
  isAxisAlignedRect,
  isConvexQuad,
  orderQuad,
  outputSizeForQuad,
  type Quad,
} from '../geometry';

const skewed: Quad = [
  { x: 10, y: 20 },
  { x: 210, y: 5 },
  { x: 230, y: 300 },
  { x: 0, y: 280 },
];

describe('quad helpers', () => {
  it('orders shuffled corners as TL, TR, BR, BL', () => {
    expect(orderQuad([skewed[2], skewed[0], skewed[3], skewed[1]])).toEqual(skewed);
  });

  it('detects convexity and self-intersection', () => {
    expect(isConvexQuad(skewed)).toBe(true);
    expect(isConvexQuad([skewed[0], skewed[2], skewed[1], skewed[3]])).toBe(false);
    expect(isConvexQuad([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(false);
  });

  it('recognises axis-aligned rectangles', () => {
    expect(isAxisAlignedRect(insetQuad({ width: 100, height: 200 }, 0.1))).toBe(true);
    expect(isAxisAlignedRect(skewed)).toBe(false);
    expect(boundingRect(insetQuad({ width: 100, height: 200 }, 0.1))).toEqual({ x: 10, y: 20, width: 80, height: 160 });
  });

  it('computes output size from edge lengths and caps the long edge', () => {
    expect(outputSizeForQuad(fullQuad({ width: 400, height: 300 }), 1000)).toEqual({ width: 400, height: 300 });
    expect(outputSizeForQuad(fullQuad({ width: 4000, height: 3000 }), 2000)).toEqual({ width: 2000, height: 1500 });
  });
});

describe('homography', () => {
  it('maps every source corner exactly onto its destination', () => {
    const dst = fullQuad({ width: 200, height: 300 });
    const h = homography(skewed, dst);
    skewed.forEach((p, i) => {
      const q = applyHomography(h, p);
      expect(q.x).toBeCloseTo(dst[i].x, 6);
      expect(q.y).toBeCloseTo(dst[i].y, 6);
    });
  });

  it('rejects degenerate quads', () => {
    const line: Quad = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    expect(() => homography(line, fullQuad({ width: 10, height: 10 }))).toThrow('Degenerate');
  });
});
