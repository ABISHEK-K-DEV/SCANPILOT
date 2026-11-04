import type { Pt } from '@/services/pdf/pdfService';

/** SVG path for a stroke in view pixels. */
export function strokePath(points: readonly Pt[], width: number, height: number): string {
  if (points.length === 0) return '';
  const p = points.map((pt) => `${(pt.x * width).toFixed(1)} ${(pt.y * height).toFixed(1)}`);
  if (p.length === 1) return `M${p[0]} L${p[0]}`;
  return `M${p[0]} ${p
    .slice(1)
    .map((s) => `L${s}`)
    .join(' ')}`;
}

export function arrowHead(from: Pt, to: Pt, width: number, height: number, size: number): string {
  const x1 = to.x * width;
  const y1 = to.y * height;
  const dx = x1 - from.x * width;
  const dy = y1 - from.y * height;
  const len = Math.hypot(dx, dy) || 1;
  const head = Math.min(len * 0.4, size);
  const ux = dx / len;
  const uy = dy / len;
  const wing = (sign: number) => `${(x1 - ux * head - sign * uy * head * 0.6).toFixed(1)} ${(y1 - uy * head + sign * ux * head * 0.6).toFixed(1)}`;
  return `M${wing(1)} L${x1.toFixed(1)} ${y1.toFixed(1)} L${wing(-1)}`;
}

export const rgbCss = (c: { r: number; g: number; b: number }) => `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
