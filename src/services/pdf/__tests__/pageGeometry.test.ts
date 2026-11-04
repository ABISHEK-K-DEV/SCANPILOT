import { displaySize, displayToUser, displayToUserMargins, normaliseRotation, type PageBox } from '../pageGeometry';

const box = (rotation: PageBox['rotation']): PageBox => ({ x: 0, y: 0, width: 200, height: 100, rotation });

describe('display ↔ user space', () => {
  it('normalises rotations', () => {
    expect(normaliseRotation(-90)).toBe(270);
    expect(normaliseRotation(450)).toBe(90);
  });

  it('swaps displayed size for quarter turns', () => {
    expect(displaySize(box(90))).toEqual({ width: 100, height: 200 });
    expect(displaySize(box(180))).toEqual({ width: 200, height: 100 });
  });

  it('maps the displayed top-left corner for every rotation', () => {
    // Unrotated: top-left of the view is (0, h).
    expect(displayToUser(box(0), 0, 0)).toEqual({ x: 0, y: 100 });
    // Rotated 90° clockwise: the view's top-left shows user (w, h) — the original top-right.
    expect(displayToUser(box(90), 0, 0)).toEqual({ x: 0, y: 0 });
    expect(displayToUser(box(180), 0, 0)).toEqual({ x: 200, y: 0 });
    expect(displayToUser(box(270), 0, 0)).toEqual({ x: 200, y: 100 });
  });

  it('respects the box origin', () => {
    expect(displayToUser({ ...box(0), x: 10, y: 20 }, 0.5, 0.5)).toEqual({ x: 110, y: 70 });
  });

  it('maps margins', () => {
    const m = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(displayToUserMargins(m, 0)).toEqual(m);
    expect(displayToUserMargins(m, 90)).toEqual({ left: 1, top: 2, right: 3, bottom: 4 });
    expect(displayToUserMargins(m, 180)).toEqual({ left: 2, right: 4, top: 3, bottom: 1 });
    expect(displayToUserMargins(m, 270)).toEqual({ left: 3, right: 1, top: 4, bottom: 2 });
  });
});
