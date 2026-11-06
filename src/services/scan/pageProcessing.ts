/**
 * Page image operations for the scan review/crop screens. Every operation
 * writes a NEW file in the session directory, so the captured original is
 * always kept until the session ends ("Reset" restores it).
 */
import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

import { getNativePageProcessor } from '@/native/pageProcessor';
import { tempDir } from '@/services/storage/paths';
import { UserFacingError } from '@/utils/errors';
import { createId } from '@/utils/id';

import { encodeBmp24 } from './bmp';
import { type Adjustments, adjust, applyFilter, type FilterId, toRgb } from './filters';
import { detectDocumentQuad, rgbaToGray } from './detect';
import { boundingRect, isAxisAlignedRect, isConvexQuad, outputSizeForQuad, type Quad, scaleQuad } from './geometry';
import type { ScanPage } from './types';
import { type RgbaImage, warpPerspective } from './warp';

/** Long-edge cap for working images (~210 dpi on A4) — readable text, bounded memory. */
export const MAX_PAGE_EDGE = 2480;
const JPEG_QUALITY = 0.9;

export function sessionDir(): Directory {
  const dir = new Directory(tempDir(), 'scan-session');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function deleteSessionFiles(): void {
  try {
    const dir = new Directory(tempDir(), 'scan-session');
    if (dir.exists) dir.delete();
  } catch {
    // Temp is also wiped on the next cold start.
  }
}

export function deleteFileQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Not ours (e.g. content://) or already gone.
  }
}

interface SavedImage {
  uri: string;
  width: number;
  height: number;
}

/** Moves a manipulator output into the session directory under a fresh name. */
async function adopt(uri: string, width: number, height: number): Promise<SavedImage> {
  const target = new File(sessionDir(), `${createId()}.jpg`);
  await new File(uri).move(target);
  return { uri: target.uri, width, height };
}

async function render(
  uri: string,
  build: (ctx: ReturnType<typeof ImageManipulator.manipulate>) => void,
): Promise<SavedImage> {
  const context = ImageManipulator.manipulate(uri);
  build(context);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return adopt(saved.uri, saved.width, saved.height);
}

/**
 * Brings any captured/picked image into the session: applies EXIF orientation,
 * caps the size, re-encodes as JPEG. Optionally deletes the source file
 * (scanner outputs are temporary files we own).
 */
export async function ingestImage(uri: string, options: { deleteSource?: boolean; width?: number; height?: number } = {}): Promise<ScanPage> {
  const first = ImageManipulator.manipulate(uri);
  const probe = await first.renderAsync();
  const longEdge = Math.max(probe.width, probe.height);
  let saved: SavedImage;
  if (longEdge > MAX_PAGE_EDGE) {
    saved = await render(uri, (ctx) => {
      ctx.resize(probe.width >= probe.height ? { width: MAX_PAGE_EDGE } : { height: MAX_PAGE_EDGE });
    });
  } else {
    const out = await probe.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    saved = await adopt(out.uri, out.width, out.height);
  }
  if (options.deleteSource) deleteFileQuietly(uri);
  return {
    id: createId(),
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    originalUri: saved.uri,
    originalWidth: saved.width,
    originalHeight: saved.height,
  };
}

export async function rotateImage(page: ScanPage, degrees: 90 | -90 | 180): Promise<SavedImage> {
  return render(page.uri, (ctx) => {
    ctx.rotate(degrees);
  });
}

/** New JPEG path in the session directory (for native outputs). */
function sessionJpeg(): string {
  return new File(sessionDir(), `${createId()}.jpg`).uri;
}

const quadNumbers = (q: Quad): number[] => q.flatMap((p) => [p.x, p.y]);

/** Lets the UI paint a progress overlay before a synchronous, CPU-heavy step. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 32));

/**
 * Crops `page` to `quad` (image pixel coordinates). Axis-aligned rectangles use
 * a fast native crop; any other quad is perspective-corrected in JS
 * (jpeg-js decode → homography warp → BMP → native JPEG encode).
 */
export async function cropImage(page: ScanPage, quad: Quad): Promise<SavedImage> {
  if (!isConvexQuad(quad)) throw new UserFacingError('The corners cross over. Drag them so they outline the page.');
  if (isAxisAlignedRect(quad, 2)) {
    const rect = boundingRect(quad);
    const originX = Math.max(0, Math.round(rect.x));
    const originY = Math.max(0, Math.round(rect.y));
    return render(page.uri, (ctx) => {
      ctx.crop({
        originX,
        originY,
        width: Math.max(1, Math.min(page.width - originX, Math.round(rect.width))),
        height: Math.max(1, Math.min(page.height - originY, Math.round(rect.height))),
      });
    });
  }

  const native = getNativePageProcessor();
  if (native) {
    const out = await native.process({ input: page.uri, quad: quadNumbers(quad), maxEdge: MAX_PAGE_EDGE, filter: 'original', quality: Math.round(JPEG_QUALITY * 100), baseOutput: sessionJpeg(), filteredOutput: null });
    return { uri: out.baseUri, width: out.baseWidth, height: out.baseHeight };
  }

  await nextFrame();
  const bytes = await new File(page.uri).bytes();
  const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  await nextFrame();
  const warped = warpPerspective(decoded, quad, outputSizeForQuad(quad, MAX_PAGE_EDGE));
  const bmp = new File(sessionDir(), `${createId()}.bmp`);
  bmp.create({ overwrite: true });
  await bmp.write(encodeBmp24(warped));
  try {
    return await render(bmp.uri, () => undefined);
  } finally {
    deleteFileQuietly(bmp.uri);
  }
}

/**
 * Applies a colour filter (and optional brightness/contrast) to `sourceUri`,
 * writing a new JPEG. The source is untouched so filters can be switched freely.
 */
export async function filterImage(sourceUri: string, filter: FilterId, adjustments: Adjustments = { brightness: 0, contrast: 0 }): Promise<SavedImage> {
  const native = getNativePageProcessor();
  if (native && filter !== 'original' && adjustments.brightness === 0 && adjustments.contrast === 0) {
    const out = await native.process({ input: sourceUri, quad: null, maxEdge: MAX_PAGE_EDGE, filter, quality: Math.round(JPEG_QUALITY * 100), baseOutput: null, filteredOutput: sessionJpeg() });
    if (out.uri && out.width && out.height) return { uri: out.uri, width: out.width, height: out.height };
  }
  await nextFrame();
  const decoded = decodeJpeg(await new File(sourceUri).bytes(), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  await nextFrame();
  const processed = adjust(applyFilter(decoded, filter), adjustments);
  const bmp = new File(sessionDir(), `${createId()}.bmp`);
  bmp.create({ overwrite: true });
  await bmp.write(encodeBmp24(toRgb(processed)));
  try {
    return await render(bmp.uri, () => undefined);
  } finally {
    deleteFileQuietly(bmp.uri);
  }
}

/** Long edge of the preview used for edge detection. */
const DETECT_EDGE = 320;

/**
 * Finds the page in a camera photo and perspective-corrects it. Returns the
 * page unchanged when no page is found with confidence (the user can still
 * drag the corners in the crop editor). `originalUri` keeps the full photo.
 */
/** Finds the page outline in image pixel coordinates (via a small preview), or null. */
async function detectPageQuad(page: ScanPage): Promise<Quad | null> {
  const small = await render(page.uri, (ctx) => {
    ctx.resize(page.width >= page.height ? { width: DETECT_EDGE } : { height: DETECT_EDGE });
  });
  try {
    const decoded = decodeJpeg(await new File(small.uri).bytes(), { useTArray: true, formatAsRGBA: true });
    const detection = detectDocumentQuad(rgbaToGray(decoded.data, decoded.width, decoded.height), decoded.width, decoded.height);
    return detection ? scaleQuad(detection.quad, page.width / small.width, page.height / small.height) : null;
  } finally {
    deleteFileQuietly(small.uri);
  }
}

/** Page outline in a photo (pixel coordinates), for the camera's live outline and auto-capture. */
export async function detectQuadInImage(uri: string, width: number, height: number): Promise<Quad | null> {
  return detectPageQuad({ id: 'probe', uri, width, height, originalUri: uri, originalWidth: width, originalHeight: height });
}

export async function autoCropPage(page: ScanPage): Promise<ScanPage> {
  try {
    const quad = await detectPageQuad(page);
    if (!quad) return page;
    const cropped = await cropImage(page, quad);
    return { ...page, uri: cropped.uri, width: cropped.width, height: cropped.height };
  } catch {
    return page;
  }
}

async function writeRgb(rgb: { width: number; height: number; data: Uint8Array }): Promise<SavedImage> {
  const bmp = new File(sessionDir(), `${createId()}.bmp`);
  bmp.create({ overwrite: true });
  await bmp.write(encodeBmp24(rgb));
  try {
    return await render(bmp.uri, () => undefined);
  } finally {
    deleteFileQuietly(bmp.uri);
  }
}

function rgbToRgba(rgb: { width: number; height: number; data: Uint8Array }): RgbaImage {
  const out = new Uint8Array(rgb.width * rgb.height * 4);
  for (let i = 0, o = 0; i < rgb.data.length; i += 3, o += 4) {
    out[o] = rgb.data[i];
    out[o + 1] = rgb.data[i + 1];
    out[o + 2] = rgb.data[i + 2];
    out[o + 3] = 255;
  }
  return { width: rgb.width, height: rgb.height, data: out };
}

/**
 * Camera pipeline in one decode: detect the page → perspective-correct →
 * filter. Decoding the full photo once (instead of once for the crop and
 * again for the filter) roughly halves the time per page on slow phones.
 * The unfiltered, cropped page is kept as `base` so Filter → Original works.
 */
export async function processCapturedPage(page: ScanPage, filter: FilterId): Promise<ScanPage> {
  let quad: Quad | null = null;
  try {
    quad = await detectPageQuad(page);
  } catch {
    quad = null;
  }
  const native = getNativePageProcessor();
  if (native) {
    // Whole pipeline in compiled code: seconds instead of 20–30 s of per-pixel JS on Hermes.
    const useQuad = quad && isConvexQuad(quad) ? quadNumbers(quad) : null;
    const out = await native.process({
      input: page.uri,
      quad: useQuad,
      maxEdge: MAX_PAGE_EDGE,
      filter,
      quality: Math.round(JPEG_QUALITY * 100),
      baseOutput: useQuad ? sessionJpeg() : null,
      filteredOutput: filter === 'original' ? null : sessionJpeg(),
    });
    const croppedNative: ScanPage = { ...page, uri: out.baseUri, width: out.baseWidth, height: out.baseHeight };
    if (filter === 'original' || !out.uri || !out.width || !out.height) return croppedNative;
    return { ...croppedNative, uri: out.uri, width: out.width, height: out.height, base: { uri: out.baseUri, width: out.baseWidth, height: out.baseHeight }, filter };
  }

  await nextFrame();
  const decoded = decodeJpeg(await new File(page.uri).bytes(), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  await nextFrame();
  let base: RgbaImage = decoded;
  let baseSaved: SavedImage = { uri: page.uri, width: page.width, height: page.height };
  if (quad && isConvexQuad(quad)) {
    const warped = warpPerspective(decoded, quad, outputSizeForQuad(quad, MAX_PAGE_EDGE));
    baseSaved = await writeRgb(warped);
    base = rgbToRgba(warped);
  }
  const cropped: ScanPage = { ...page, uri: baseSaved.uri, width: baseSaved.width, height: baseSaved.height };
  if (filter === 'original') return cropped;
  await nextFrame();
  const filtered = await writeRgb(toRgb(applyFilter(base, filter)));
  return { ...cropped, uri: filtered.uri, width: filtered.width, height: filtered.height, base: { uri: baseSaved.uri, width: baseSaved.width, height: baseSaved.height }, filter };
}

/** Small previews of every filter for the review screen's filter strip. */
export async function filterPreviews(sourceUri: string, filters: readonly FilterId[]): Promise<Partial<Record<FilterId, string>>> {
  const small = await render(sourceUri, (ctx) => {
    ctx.resize({ width: 180 });
  });
  const out: Partial<Record<FilterId, string>> = { original: small.uri };
  for (const filter of filters) {
    if (filter === 'original') continue;
    try {
      out[filter] = (await filterImage(small.uri, filter)).uri;
    } catch {
      // Leave this preview out; the chip still works.
    }
  }
  return out;
}

/** Splits a two-page book spread into its left and right pages. */
export async function splitSpread(page: ScanPage): Promise<[ScanPage, ScanPage]> {
  const half = Math.floor(page.width / 2);
  const side = async (x: number, width: number): Promise<ScanPage> => {
    const saved = await render(page.uri, (ctx) => {
      ctx.crop({ originX: x, originY: 0, width, height: page.height });
    });
    return { id: createId(), uri: saved.uri, width: saved.width, height: saved.height, originalUri: saved.uri, originalWidth: saved.width, originalHeight: saved.height };
  };
  return [await side(0, half), await side(half, page.width - half)];
}
