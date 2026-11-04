/**
 * Maps between what the user sees on screen ("display" space: origin top-left,
 * y down, after the page's /Rotate is applied) and PDF user space (origin
 * bottom-left, y up, unrotated). All overlay tools work in display fractions
 * (0–1), so they behave the same on rotated pages.
 */
export type Rotation = 0 | 90 | 180 | 270;

export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: Rotation;
}

export function normaliseRotation(angle: number): Rotation {
  const r = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return r as Rotation;
}

/** Size of the page as displayed (width/height swap for 90°/270°). */
export function displaySize(box: PageBox): { width: number; height: number } {
  return box.rotation % 180 === 0 ? { width: box.width, height: box.height } : { width: box.height, height: box.width };
}

/** Display fraction (fx, fy from top-left) → PDF user-space point. */
export function displayToUser(box: PageBox, fx: number, fy: number): { x: number; y: number } {
  const { width: dw, height: dh } = displaySize(box);
  const X = fx * dw; // display x from left
  const Y = (1 - fy) * dh; // display y from bottom
  const { width: w, height: h } = box;
  let x: number;
  let y: number;
  switch (box.rotation) {
    case 90:
      x = w - Y;
      y = X;
      break;
    case 180:
      x = w - X;
      y = h - Y;
      break;
    case 270:
      x = Y;
      y = h - X;
      break;
    default:
      x = X;
      y = Y;
  }
  return { x: box.x + x, y: box.y + y };
}

/** Margins measured on the displayed page → margins in unrotated user space. */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function displayToUserMargins(m: Margins, rotation: Rotation): Margins {
  switch (rotation) {
    case 90:
      return { left: m.top, top: m.right, right: m.bottom, bottom: m.left };
    case 180:
      return { left: m.right, right: m.left, top: m.bottom, bottom: m.top };
    case 270:
      return { left: m.bottom, right: m.top, top: m.left, bottom: m.right };
    default:
      return { ...m };
  }
}
