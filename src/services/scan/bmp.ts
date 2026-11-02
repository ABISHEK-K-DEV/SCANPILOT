import type { RgbImage } from './warp';

/**
 * Encodes a 24-bit uncompressed BMP. Used as a lossless hand-off format: the
 * native image manipulator decodes it and re-encodes JPEG much faster than JS could.
 */
export function encodeBmp24({ width, height, data }: RgbImage): Uint8Array {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const fileSize = 54 + pixelBytes;
  const out = new Uint8Array(fileSize);
  const view = new DataView(out.buffer);
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true); // pixel data offset
  view.setUint32(14, 40, true); // BITMAPINFOHEADER size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up rows
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 24, true); // bits per pixel
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, 2835, true); // 72 dpi
  view.setInt32(42, 2835, true);
  for (let y = 0; y < height; y += 1) {
    const srcRow = (height - 1 - y) * width * 3;
    let o = 54 + y * rowSize;
    for (let x = 0; x < width; x += 1) {
      const i = srcRow + x * 3;
      out[o] = data[i + 2];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i];
      o += 3;
    }
  }
  return out;
}
