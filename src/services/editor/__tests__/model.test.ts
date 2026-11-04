import { boundsOf, type EditorItem, hitTest, moveItem, redactionsByPage, resizeBoxed, toOverlays, trimStrokes } from '../model';

const black = { r: 0, g: 0, b: 0 };
const sig: EditorItem = {
  id: 's',
  page: 0,
  kind: 'signature',
  box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 },
  strokes: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]],
  color: black,
};
const rect: EditorItem = { id: 'r', page: 1, kind: 'shape', shape: 'redact', from: { x: 0.5, y: 0.5 }, to: { x: 0.2, y: 0.3 }, color: black, width: 0 };

describe('editor model', () => {
  it('computes bounds for shapes drawn in any direction', () => {
    expect(boundsOf(rect)).toEqual({ x: 0.2, y: 0.3, w: 0.3, h: 0.2 });
  });

  it('hit-tests the topmost item on the right page', () => {
    expect(hitTest([sig, rect], 0, { x: 0.2, y: 0.15 })?.id).toBe('s');
    expect(hitTest([sig, rect], 0, { x: 0.8, y: 0.8 })).toBeNull();
    expect(hitTest([sig, rect], 1, { x: 0.3, y: 0.4 })?.id).toBe('r');
  });

  it('moves items but keeps them on the page', () => {
    const moved = moveItem(sig, 0.9, -0.5);
    expect(boundsOf(moved)).toEqual({ x: 0.7, y: 0, w: 0.3, h: 0.1 });
  });

  it('resizes signatures keeping their aspect', () => {
    const r = resizeBoxed(sig as Extract<EditorItem, { box: unknown }>, 0.6, 0.9, 0.75);
    expect(r.box.w).toBeCloseTo(0.6);
    // aspect (display) = 0.3/0.1 = 3 → h = w * pageAspect / 3
    expect(r.box.h).toBeCloseTo((0.6 * 0.75) / 3);
  });

  it('trims strokes to their bounding box', () => {
    const t = trimStrokes([[{ x: 10, y: 20 }, { x: 30, y: 30 }]]);
    expect(t?.strokes[0]).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(t?.aspect).toBe(2);
    expect(trimStrokes([[{ x: 1, y: 1 }]])).toBeNull();
  });

  it('converts to engine overlays', () => {
    const overlays = toOverlays([sig, rect, { id: 't', page: 0, kind: 'text', box: { x: 0.1, y: 0.5, w: 0.4, h: 0.05 }, text: 'Hi', color: black }], () => 0.75);
    expect(overlays.map((o) => o.type)).toEqual(['ink', 'rect', 'text']);
    const ink = overlays[0] as Extract<(typeof overlays)[number], { type: 'ink' }>;
    expect(ink.strokes[0][1]).toEqual({ x: 0.4, y: 0.2 }); // box-relative → page fractions
    const text = overlays[2] as Extract<(typeof overlays)[number], { type: 'text' }>;
    expect(text.size).toBeCloseTo((0.05 * 0.8) / 0.75);
  });

  it('groups redactions by page', () => {
    expect(redactionsByPage([sig, rect]).get(1)).toEqual([{ x: 0.2, y: 0.3, width: 0.3, height: 0.2 }]);
    expect(redactionsByPage([sig]).size).toBe(0);
  });
});
