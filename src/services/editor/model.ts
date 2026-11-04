/**
 * Page-editor model (pure). Items live in display fractions of a page
 * (0–1, origin top-left), so they are independent of screen size and map
 * directly onto `applyOverlays` in the PDF engine.
 */
import type { Overlay, Pt, RgbColor } from '@/services/pdf/pdfService';

export type DrawTool = 'pen' | 'highlighter';
export type ShapeTool = 'rect' | 'ellipse' | 'line' | 'arrow' | 'whiteout' | 'redact';
export type EditorTool = 'select' | DrawTool | ShapeTool | 'text';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Base {
  id: string;
  page: number;
}

export type EditorItem =
  | (Base & { kind: 'ink'; strokes: Pt[][]; color: RgbColor; width: number; opacity: number })
  | (Base & { kind: 'shape'; shape: ShapeTool; from: Pt; to: Pt; color: RgbColor; width: number })
  | (Base & { kind: 'text'; box: Box; text: string; color: RgbColor })
  | (Base & { kind: 'signature'; box: Box; strokes: Pt[][]; color: RgbColor })
  | (Base & { kind: 'image'; box: Box; uri: string; bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg'; aspect: number });

export type Boxed = Extract<EditorItem, { box: Box }>;

let seed = 0;
export const newItemId = () => `i${Date.now().toString(36)}${(seed += 1)}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function boundsOf(item: EditorItem): Box {
  switch (item.kind) {
    case 'ink': {
      const pts = item.strokes.flat();
      if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const pad = item.width / 2;
      const x = Math.min(...xs) - pad;
      const y = Math.min(...ys) - pad;
      return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
    }
    case 'shape':
      return { x: Math.min(item.from.x, item.to.x), y: Math.min(item.from.y, item.to.y), w: Math.abs(item.to.x - item.from.x), h: Math.abs(item.to.y - item.from.y) };
    default:
      return item.box;
  }
}

/** Topmost item on `page` containing point `p` (with a small touch tolerance). */
export function hitTest(items: readonly EditorItem[], page: number, p: Pt, tolerance = 0.02): EditorItem | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const it = items[i];
    if (it.page !== page) continue;
    const b = boundsOf(it);
    if (p.x >= b.x - tolerance && p.x <= b.x + b.w + tolerance && p.y >= b.y - tolerance && p.y <= b.y + b.h + tolerance) return it;
  }
  return null;
}

const shift = (p: Pt, dx: number, dy: number): Pt => ({ x: p.x + dx, y: p.y + dy });

export function moveItem(item: EditorItem, dx: number, dy: number): EditorItem {
  // Keep the item on the page.
  const b = boundsOf(item);
  const ddx = Math.min(Math.max(dx, -b.x), 1 - (b.x + b.w));
  const ddy = Math.min(Math.max(dy, -b.y), 1 - (b.y + b.h));
  switch (item.kind) {
    case 'ink':
      return { ...item, strokes: item.strokes.map((s) => s.map((p) => shift(p, ddx, ddy))) };
    case 'shape':
      return { ...item, from: shift(item.from, ddx, ddy), to: shift(item.to, ddx, ddy) };
    default:
      return { ...item, box: { ...item.box, x: item.box.x + ddx, y: item.box.y + ddy } } as EditorItem;
  }
}

/** Resizes a boxed item from its bottom-right corner, keeping aspect for signatures/images. */
export function resizeBoxed(item: Boxed, w: number, h: number, pageAspect: number): Boxed {
  const minW = 0.04;
  let nw = Math.max(minW, Math.min(1 - item.box.x, w));
  let nh = Math.max(0.015, Math.min(1 - item.box.y, h));
  if (item.kind === 'signature' || item.kind === 'image') {
    // aspect = width/height in display units; fractions differ by the page aspect (w/h).
    const aspect = item.kind === 'image' ? item.aspect : item.box.w / item.box.h;
    nh = (nw * pageAspect) / aspect;
    if (item.box.y + nh > 1) {
      nh = 1 - item.box.y;
      nw = (nh * aspect) / pageAspect;
    }
  }
  return { ...item, box: { ...item.box, w: nw, h: nh } } as Boxed;
}

/** Normalises raw strokes to their bounding box (0–1). Returns null for empty input. */
export function trimStrokes(strokes: readonly Pt[][]): { strokes: Pt[][]; aspect: number } | null {
  const pts = strokes.flat();
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(Math.max(...xs) - x0, 1e-6);
  const h = Math.max(Math.max(...ys) - y0, 1e-6);
  return { strokes: strokes.map((s) => s.map((p) => ({ x: (p.x - x0) / w, y: (p.y - y0) / h }))), aspect: w / h };
}

const BLACK: RgbColor = { r: 0, g: 0, b: 0 };
const WHITE: RgbColor = { r: 1, g: 1, b: 1 };

/** Text box height maps to font size: text size = 80% of a line's box height. */
export const TEXT_LINE_FACTOR = 0.8;

export function toOverlays(items: readonly EditorItem[], pageAspect: (page: number) => number): Overlay[] {
  const out: Overlay[] = [];
  for (const it of items) {
    switch (it.kind) {
      case 'ink':
        out.push({ type: 'ink', page: it.page, strokes: it.strokes, color: it.color, width: it.width, opacity: it.opacity });
        break;
      case 'signature':
        out.push({
          type: 'ink',
          page: it.page,
          strokes: it.strokes.map((s) => s.map((p) => ({ x: it.box.x + p.x * it.box.w, y: it.box.y + p.y * it.box.h }))),
          color: it.color,
          width: Math.max(0.0025, it.box.w * 0.025),
        });
        break;
      case 'shape': {
        const base = { page: it.page, from: it.from, to: it.to };
        if (it.shape === 'rect') out.push({ type: 'rect', ...base, color: it.color, width: it.width });
        else if (it.shape === 'whiteout') out.push({ type: 'rect', ...base, color: WHITE, width: 0, fill: WHITE });
        else if (it.shape === 'redact') out.push({ type: 'rect', ...base, color: BLACK, width: 0, fill: BLACK });
        else if (it.shape === 'ellipse') out.push({ type: 'ellipse', ...base, color: it.color, width: it.width });
        else out.push({ type: 'line', ...base, color: it.color, width: it.width, arrow: it.shape === 'arrow' });
        break;
      }
      case 'text': {
        const lines = Math.max(1, it.text.split('\n').length);
        // Font size relative to the displayed page width.
        const lineHeight = it.box.h / lines; // fraction of page height
        const size = (lineHeight * TEXT_LINE_FACTOR) / pageAspect(it.page);
        out.push({ type: 'text', page: it.page, at: { x: it.box.x, y: it.box.y }, text: it.text, size, color: it.color });
        break;
      }
      case 'image':
        out.push({ type: 'image', page: it.page, from: { x: it.box.x, y: it.box.y }, to: { x: it.box.x + it.box.w, y: it.box.y + it.box.h }, bytes: it.bytes, mimeType: it.mimeType });
        break;
    }
  }
  return out;
}

/** Redaction boxes per page, as rectangles in page fractions. */
export function redactionsByPage(items: readonly EditorItem[]): Map<number, { x: number; y: number; width: number; height: number }[]> {
  const map = new Map<number, { x: number; y: number; width: number; height: number }[]>();
  for (const it of items) {
    if (it.kind !== 'shape' || it.shape !== 'redact') continue;
    const b = boundsOf(it);
    const list = map.get(it.page) ?? [];
    list.push({ x: clamp01(b.x), y: clamp01(b.y), width: b.w, height: b.h });
    map.set(it.page, list);
  }
  return map;
}
