import { encodeBmp24 } from '../bmp';
import { fullQuad, type Quad } from '../geometry';
import { type RgbaImage, warpPerspective } from '../warp';

/** Image whose left half is red and right half blue. */
function halves(width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const left = x < width / 2;
      data[i] = left ? 255 : 0;
      data[i + 2] = left ? 0 : 255;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

const pixel = (img: { width: number; data: Uint8Array }, x: number, y: number) => {
  const i = (y * img.width + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

describe('warpPerspective', () => {
  it('is an identity copy for the full quad', () => {
    const src = halves(8, 4);
    const out = warpPerspective(src, fullQuad(src), { width: 8, height: 4 });
    expect(pixel(out, 0, 0)).toEqual([255, 0, 0]);
    expect(pixel(out, 7, 3)).toEqual([0, 0, 255]);
  });

  it('extracts and upscales a sub-region', () => {
    const src = halves(100, 100);
    const rightHalf: Quad = [
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 100 },
    ];
    const out = warpPerspective(src, rightHalf, { width: 20, height: 20 });
    expect(pixel(out, 2, 2)).toEqual([0, 0, 255]);
    expect(pixel(out, 18, 18)).toEqual([0, 0, 255]);
  });

  it('straightens a mirrored quad (corner order defines orientation)', () => {
    const src = halves(10, 10);
    const mirrored: Quad = [
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ];
    const out = warpPerspective(src, mirrored, { width: 10, height: 10 });
    expect(pixel(out, 0, 5)).toEqual([0, 0, 255]);
    expect(pixel(out, 9, 5)).toEqual([255, 0, 0]);
  });

  it('fills area outside the source with white', () => {
    const src = halves(10, 10);
    const beyond: Quad = [
      { x: -20, y: -20 },
      { x: 30, y: -20 },
      { x: 30, y: 30 },
      { x: -20, y: 30 },
    ];
    expect(pixel(warpPerspective(src, beyond, { width: 10, height: 10 }), 0, 0)).toEqual([255, 255, 255]);
  });
});

describe('encodeBmp24', () => {
  it('writes a valid header, BGR order, bottom-up rows and 4-byte row padding', () => {
    // 1×2 image: top pixel red, bottom pixel green.
    const bmp = encodeBmp24({ width: 1, height: 2, data: Uint8Array.from([255, 0, 0, 0, 255, 0]) });
    const view = new DataView(bmp.buffer);
    expect(String.fromCharCode(bmp[0], bmp[1])).toBe('BM');
    expect(view.getUint32(2, true)).toBe(bmp.length);
    expect(view.getInt32(18, true)).toBe(1);
    expect(view.getInt32(22, true)).toBe(2);
    expect(view.getUint16(28, true)).toBe(24);
    expect(bmp.length).toBe(54 + 4 * 2); // 3 bytes padded to 4 per row
    expect([...bmp.slice(54, 57)]).toEqual([0, 255, 0]); // first stored row = bottom (green), BGR
    expect([...bmp.slice(58, 61)]).toEqual([0, 0, 255]); // top row red → BGR
  });
});
