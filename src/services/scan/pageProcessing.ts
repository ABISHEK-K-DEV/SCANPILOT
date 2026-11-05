/**
 * Page image operations for the scan review/crop screens. Every operation
 * writes a NEW file in the session directory, so the captured original is
 * always kept until the session ends ("Reset" restores it).
 */
import { Directory, File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';

import { tempDir } from '@/services/storage/paths';
import { UserFacingError } from '@/utils/errors';
import { createId } from '@/utils/id';

import { encodeBmp24 } from './bmp';
import { detectDocumentQuad } from './detect';
import { type Adjustments, adjust, applyFilter, type FilterId, toRgb } from './filters';
import { boundingRect, isAxisAlignedRect, isConvexQuad, outputSizeForQuad, type Quad } from './geometry';
import type { ScanPage } from './types';
import { warpPerspective } from './warp';

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

/** Long edge of the preview used for page detection (fast, ~50 ms). */
const DETECT_EDGE = 360;

/**
 * Finds the page in a photo. Returns the quad in full-image pixels, or null
 * if no page stands out clearly from the background.
 */
export async function detectPageQuad(page: ScanPage): Promise<Quad | null> {
  const ctx = ImageManipulator.manipulate(page.uri);
  ctx.resize(page.width >= page.height ? { width: DETECT_EDGE } : { height: DETECT_EDGE });
  const small = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  try {
    const decoded = decodeJpeg(await new File(small.uri).bytes(), { useTArray: true, formatAsRGBA: true });
    const quad = detectDocumentQuad(decoded);
    if (!quad) return null;
    const sx = page.width / decoded.width;
    const sy = page.height / decoded.height;
    return quad.map((p) => ({ x: Math.min(page.width, p.x * sx), y: Math.min(page.height, p.y * sy) })) as Quad;
  } finally {
    deleteFileQuietly(small.uri);
  }
}
