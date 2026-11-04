/**
 * Platform-independent PDF operations built on pdf-lib (MIT).
 *
 * Every function takes and returns raw bytes so it can run in React Native,
 * on the web, and in Node-based unit tests. File-system access lives in
 * `services/storage`, not here.
 *
 * pdf-lib does not render pages and cannot rewrite encrypted PDFs; such files
 * are rejected for modification with a clear error instead of producing a
 * corrupt output.
 */
import { degrees, LineCapStyle, PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from '@cantoo/pdf-lib';

import { displaySize, displayToUser, displayToUserMargins, type Margins, normaliseRotation, type PageBox } from './pageGeometry';

import { CancelledError, UserFacingError } from '@/utils/errors';

import type {
  CancelToken,
  ImageInput,
  ImagesToPdfOptions,
  OperationOptions,
  PdfInfo,
  RotationDelta,
} from './types';

const A4: [number, number] = [595.28, 841.89];
const LETTER: [number, number] = [612, 792];
const MM = 72 / 25.4;
const RECEIPT_WIDTH = 80 * MM;
const CARD_SIZES: Record<'business-card' | 'id-card', [number, number]> = {
  'business-card': [55 * MM, 85 * MM],
  'id-card': [53.98 * MM, 85.6 * MM],
};

/** Portrait [width, height] of fixed-size presets. */
function fixedPageSize(pageSize: 'a4' | 'letter' | 'business-card' | 'id-card'): [number, number] {
  if (pageSize === 'a4') return A4;
  if (pageSize === 'letter') return LETTER;
  return CARD_SIZES[pageSize];
}
const PRODUCER = 'ScanPilot';

function throwIfCancelled(token?: CancelToken): void {
  if (token?.cancelled) throw new CancelledError();
}

async function loadForReading(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (error) {
    throw new UserFacingError('This file is not a valid PDF or is damaged.', error);
  }
}

async function loadForEditing(bytes: Uint8Array): Promise<PDFDocument> {
  return loadUnencrypted(bytes);
}

async function loadUnencrypted(bytes: Uint8Array): Promise<PDFDocument> {
  const doc = await loadForReading(bytes);
  if (doc.isEncrypted) {
    throw new UserFacingError(
      'This PDF is password-protected or encrypted. ScanPilot cannot modify it without damaging it.',
    );
  }
  return doc;
}

function stampMetadata(doc: PDFDocument, title?: string): void {
  doc.setProducer(PRODUCER);
  doc.setCreator(PRODUCER);
  doc.setModificationDate(new Date());
  if (title) doc.setTitle(title);
}

async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

function assertIndices(indices: readonly number[], pageCount: number): void {
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
      throw new UserFacingError(`Page ${index + 1} does not exist in this document.`);
    }
  }
}

export function detectImageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  return null;
}

export function isPdf(bytes: Uint8Array): boolean {
  // "%PDF-" may be preceded by a little junk; the spec allows it within the first 1024 bytes.
  const limit = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i < limit; i += 1) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) {
      return true;
    }
  }
  return false;
}

export async function getPdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const doc = await loadForReading(bytes);
  let title: string | null = null;
  try {
    title = doc.getTitle() ?? null;
  } catch {
    title = null; // Encrypted metadata cannot be decoded.
  }
  return { pageCount: doc.getPageCount(), isEncrypted: doc.isEncrypted, title };
}

/** Creates a PDF with one image per page. Only JPEG and PNG are embeddable. */
export async function imagesToPdf(images: readonly ImageInput[], options: ImagesToPdfOptions = {}): Promise<Uint8Array> {
  if (images.length === 0) throw new UserFacingError('Select at least one image.');
  const { pageSize = 'fit', margin = 0, onProgress, cancelToken, title } = options;
  const doc = await PDFDocument.create();
  stampMetadata(doc, title);
  doc.setCreationDate(new Date());

  for (let i = 0; i < images.length; i += 1) {
    throwIfCancelled(cancelToken);
    const { bytes } = images[i];
    const type = images[i].mimeType ?? detectImageType(bytes);
    if (type === null) throw new UserFacingError(`Image ${i + 1} is not a JPEG or PNG.`);
    const image = type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

    const exact = images[i].pageSizePt;
    if (exact) {
      const page = doc.addPage([exact.width, exact.height]);
      page.drawImage(image, { x: 0, y: 0, width: exact.width, height: exact.height });
    } else if (pageSize === 'fit' || pageSize === 'receipt') {
      // Keep the image's aspect ratio: fit scales the long edge to A4 length, receipt fixes the width at 80 mm.
      const scale = pageSize === 'receipt' ? RECEIPT_WIDTH / image.width : A4[1] / Math.max(image.width, image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const page = doc.addPage([width, height]);
      page.drawImage(image, { x: 0, y: 0, width, height });
    } else {
      const base = fixedPageSize(pageSize);
      const landscape = image.width > image.height;
      const [pw, ph] = landscape ? [base[1], base[0]] : base;
      const page = doc.addPage([pw, ph]);
      const inset = Math.min(margin, pw / 4, ph / 4);
      const fit = image.scaleToFit(pw - inset * 2, ph - inset * 2);
      page.drawImage(image, { x: (pw - fit.width) / 2, y: (ph - fit.height) / 2, width: fit.width, height: fit.height });
    }
    onProgress?.(i + 1, images.length);
  }
  throwIfCancelled(cancelToken);
  return save(doc);
}

/** Merges documents in the given order. */
export async function mergePdfs(inputs: readonly Uint8Array[], options: OperationOptions & { title?: string } = {}): Promise<Uint8Array> {
  if (inputs.length < 2) throw new UserFacingError('Select at least two PDFs to merge.');
  const out = await PDFDocument.create();
  stampMetadata(out, options.title);
  out.setCreationDate(new Date());
  for (let i = 0; i < inputs.length; i += 1) {
    throwIfCancelled(options.cancelToken);
    const src = await loadForEditing(inputs[i]);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((page) => out.addPage(page));
    options.onProgress?.(i + 1, inputs.length);
  }
  return save(out);
}

/** Copies the given zero-based pages (in the given order, duplicates allowed) into a new PDF. */
export async function extractPages(bytes: Uint8Array, indices: readonly number[], options: OperationOptions = {}): Promise<Uint8Array> {
  if (indices.length === 0) throw new UserFacingError('Select at least one page.');
  const src = await loadForEditing(bytes);
  assertIndices(indices, src.getPageCount());
  throwIfCancelled(options.cancelToken);
  const out = await PDFDocument.create();
  stampMetadata(out, src.getTitle());
  const pages = await out.copyPages(src, [...indices]);
  pages.forEach((page) => out.addPage(page));
  options.onProgress?.(1, 1);
  return save(out);
}

/** Splits into groups of pages, e.g. `[[0,1],[2]]`. Each group becomes one PDF. */
export async function splitPdf(
  bytes: Uint8Array,
  groups: readonly (readonly number[])[],
  options: OperationOptions = {},
): Promise<Uint8Array[]> {
  if (groups.length === 0) throw new UserFacingError('Nothing to split.');
  const src = await loadForEditing(bytes);
  const outputs: Uint8Array[] = [];
  for (let g = 0; g < groups.length; g += 1) {
    throwIfCancelled(options.cancelToken);
    const group = groups[g];
    if (group.length === 0) throw new UserFacingError('Each part must contain at least one page.');
    assertIndices(group, src.getPageCount());
    const out = await PDFDocument.create();
    stampMetadata(out);
    const pages = await out.copyPages(src, [...group]);
    pages.forEach((page) => out.addPage(page));
    outputs.push(await save(out));
    options.onProgress?.(g + 1, groups.length);
  }
  return outputs;
}

/** One PDF per page. */
export async function splitIntoSinglePages(bytes: Uint8Array, options: OperationOptions = {}): Promise<Uint8Array[]> {
  const info = await getPdfInfo(bytes);
  return splitPdf(bytes, Array.from({ length: info.pageCount }, (_, i) => [i]), options);
}

function normaliseAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function rotatePage(page: PDFPage, delta: number): void {
  page.setRotation(degrees(normaliseAngle(page.getRotation().angle + delta)));
}

/** Rotates the given pages (all pages when `indices` is omitted) by a delta. */
export async function rotatePages(bytes: Uint8Array, delta: RotationDelta, indices?: readonly number[]): Promise<Uint8Array> {
  const doc = await loadForEditing(bytes);
  const targets = indices ?? doc.getPageIndices();
  assertIndices(targets, doc.getPageCount());
  new Set(targets).forEach((index) => rotatePage(doc.getPage(index), delta));
  stampMetadata(doc);
  return save(doc);
}

/**
 * Rebuilds the document from a page plan. Each entry references a source page
 * and an absolute extra rotation. Supports reorder, delete (omit), duplicate
 * (repeat) and rotate in a single pass — the basis of the page organiser.
 */
export interface PagePlanEntry {
  sourceIndex: number;
  /** Clockwise rotation to add, in degrees (multiple of 90). */
  rotate?: number;
}

export async function applyPagePlan(bytes: Uint8Array, plan: readonly PagePlanEntry[], options: OperationOptions = {}): Promise<Uint8Array> {
  if (plan.length === 0) throw new UserFacingError('A PDF must keep at least one page.');
  const src = await loadForEditing(bytes);
  assertIndices(plan.map((entry) => entry.sourceIndex), src.getPageCount());
  for (const entry of plan) {
    if (entry.rotate !== undefined && entry.rotate % 90 !== 0) throw new UserFacingError('Rotation must be a multiple of 90°.');
  }
  throwIfCancelled(options.cancelToken);
  const out = await PDFDocument.create();
  stampMetadata(out, src.getTitle());
  const copied = await out.copyPages(src, plan.map((entry) => entry.sourceIndex));
  copied.forEach((page, i) => {
    const extra = plan[i].rotate ?? 0;
    if (extra !== 0) rotatePage(page, extra);
    out.addPage(page);
    options.onProgress?.(i + 1, copied.length);
  });
  return save(out);
}

export async function reorderPages(bytes: Uint8Array, newOrder: readonly number[]): Promise<Uint8Array> {
  const info = await getPdfInfo(bytes);
  const sorted = [...newOrder].sort((a, b) => a - b);
  if (sorted.length !== info.pageCount || sorted.some((value, i) => value !== i)) {
    throw new UserFacingError('The new order must contain every page exactly once.');
  }
  return applyPagePlan(bytes, newOrder.map((sourceIndex) => ({ sourceIndex })));
}

export async function deletePages(bytes: Uint8Array, indices: readonly number[]): Promise<Uint8Array> {
  const info = await getPdfInfo(bytes);
  assertIndices(indices, info.pageCount);
  const remove = new Set(indices);
  const keep = Array.from({ length: info.pageCount }, (_, i) => i).filter((i) => !remove.has(i));
  if (keep.length === 0) throw new UserFacingError('A PDF must keep at least one page. Delete the document instead.');
  return applyPagePlan(bytes, keep.map((sourceIndex) => ({ sourceIndex })));
}

export async function duplicatePage(bytes: Uint8Array, index: number): Promise<Uint8Array> {
  const info = await getPdfInfo(bytes);
  assertIndices([index], info.pageCount);
  const plan: PagePlanEntry[] = [];
  for (let i = 0; i < info.pageCount; i += 1) {
    plan.push({ sourceIndex: i });
    if (i === index) plan.push({ sourceIndex: i });
  }
  return applyPagePlan(bytes, plan);
}


// ---------------------------------------------------------------------------
// Editing operations (Milestones 4–5). All return a NEW PDF; inputs are untouched.
// ---------------------------------------------------------------------------

export type RgbColor = { r: number; g: number; b: number };
const toRgb = (c: RgbColor) => rgb(c.r, c.g, c.b);

function pageBox(page: PDFPage): PageBox {
  const crop = page.getCropBox();
  return { x: crop.x, y: crop.y, width: crop.width, height: crop.height, rotation: normaliseRotation(page.getRotation().angle) };
}

function targetPages(doc: PDFDocument, pages?: readonly number[]): number[] {
  const all = doc.getPageIndices();
  if (!pages) return all;
  assertIndices(pages, doc.getPageCount());
  return [...new Set(pages)];
}

/**
 * Standard PDF fonts only cover Latin (WinAnsi) characters. Characters that
 * cannot be encoded are reported so the UI can explain instead of failing.
 */
export function unsupportedCharacters(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const winAnsiExtra = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
    if (ch === '\n' || ch === '\t') continue;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || winAnsiExtra.includes(ch)) continue;
    bad.add(ch);
  }
  return [...bad];
}

function assertLatin(text: string): void {
  const bad = unsupportedCharacters(text);
  if (bad.length > 0) {
    throw new UserFacingError(`These characters are not supported yet: ${bad.slice(0, 8).join(' ')}. Please use Latin letters, numbers and common symbols.`);
  }
}

/** Draws text so it reads upright on the displayed (possibly rotated) page. */
function drawDisplayText(page: PDFPage, box: PageBox, text: string, fx: number, fy: number, size: number, font: PDFFont, color: RgbColor, opacity = 1, extraRotate = 0) {
  const p = displayToUser(box, fx, fy);
  page.drawText(text, { x: p.x, y: p.y, size, font, color: toRgb(color), opacity, rotate: degrees(box.rotation + extraRotate) });
}

export interface WatermarkOptions {
  text: string;
  /** 0–1 */
  opacity?: number;
  /** Font size as a fraction of the displayed page width. */
  size?: number;
  color?: RgbColor;
  layout?: 'diagonal' | 'center' | 'tile';
  pages?: number[];
}

export async function addWatermark(bytes: Uint8Array, options: WatermarkOptions): Promise<Uint8Array> {
  const text = options.text.trim();
  if (!text) throw new UserFacingError('Enter the watermark text.');
  assertLatin(text);
  const doc = await loadForEditing(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = options.color ?? { r: 0.85, g: 0.2, b: 0.2 };
  const opacity = options.opacity ?? 0.25;
  const layout = options.layout ?? 'diagonal';
  for (const index of targetPages(doc, options.pages)) {
    const page = doc.getPage(index);
    const box = pageBox(page);
    const { width: dw, height: dh } = displaySize(box);
    const size = Math.max(8, dw * (options.size ?? (layout === 'tile' ? 0.06 : 0.1)));
    const textWidth = font.widthOfTextAtSize(text, size);
    const angle = layout === 'center' ? 0 : 35;
    const rad = (angle * Math.PI) / 180;
    // Start point so the text (rising at `angle` on screen) is centred on display point (cx, cy).
    // Display space has y pointing down; the baseline sits ~0.35 em below the visual centre.
    const place = (cx: number, cy: number) => {
      const sx = cx - (Math.cos(rad) * textWidth) / 2 + Math.sin(rad) * size * 0.35;
      const sy = cy + (Math.sin(rad) * textWidth) / 2 + Math.cos(rad) * size * 0.35;
      drawDisplayText(page, box, text, sx / dw, sy / dh, size, font, color, opacity, angle);
    };
    if (layout === 'tile') {
      const stepX = textWidth * 1.1 + size * 2;
      const stepY = size * 5;
      for (let y = stepY / 2; y < dh + stepY; y += stepY) {
        for (let x = ((y / stepY) % 2) * (stepX / 2); x < dw + stepX; x += stepX) place(x, y);
      }
    } else {
      place(dw / 2, dh / 2);
    }
  }
  stampMetadata(doc);
  return save(doc);
}

export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
export type NumberFormat = 'n' | 'n-of-total' | 'page-n' | 'page-n-of-total';

export function formatPageNumber(format: NumberFormat, n: number, total: number): string {
  switch (format) {
    case 'n-of-total':
      return `${n} / ${total}`;
    case 'page-n':
      return `Page ${n}`;
    case 'page-n-of-total':
      return `Page ${n} of ${total}`;
    default:
      return `${n}`;
  }
}

export interface PageNumberOptions {
  position?: NumberPosition;
  format?: NumberFormat;
  startAt?: number;
  /** Points */
  fontSize?: number;
  /** Skip numbering on the first page (e.g. a cover). */
  skipFirst?: boolean;
}

export async function addPageNumbers(bytes: Uint8Array, options: PageNumberOptions = {}): Promise<Uint8Array> {
  const doc = await loadForEditing(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const { position = 'bottom-center', format = 'n', startAt = 1, fontSize = 11, skipFirst = false } = options;
  const pages = doc.getPages();
  const numbered = skipFirst ? pages.length - 1 : pages.length;
  pages.forEach((page, i) => {
    if (skipFirst && i === 0) return;
    const n = startAt + (skipFirst ? i - 1 : i);
    const label = formatPageNumber(format, n, startAt + numbered - 1);
    const box = pageBox(page);
    const { width: dw, height: dh } = displaySize(box);
    const margin = Math.max(18, Math.min(dw, dh) * 0.04);
    const w = font.widthOfTextAtSize(label, fontSize);
    const [v, hPos] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
    const x = hPos === 'left' ? margin : hPos === 'right' ? dw - margin - w : (dw - w) / 2;
    const yBaseline = v === 'top' ? margin + fontSize : dh - margin;
    drawDisplayText(page, box, label, x / dw, yBaseline / dh, fontSize, font, { r: 0.25, g: 0.27, b: 0.32 });
  });
  stampMetadata(doc);
  return save(doc);
}

export interface ProtectOptions {
  /** Needed to open the PDF. */
  password: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  allowEditing?: boolean;
}

/** Encrypts with AES-256 (PDF 2.0 security handler). */
export async function protectPdf(bytes: Uint8Array, options: ProtectOptions): Promise<Uint8Array> {
  if (options.password.length < 4) throw new UserFacingError('Use a password with at least 4 characters.');
  const doc = await loadForEditing(bytes);
  const out = await PDFDocument.create();
  (await out.copyPages(doc, doc.getPageIndices())).forEach((p) => out.addPage(p));
  stampMetadata(out, doc.getTitle());
  // Owner password is random: permissions can't be lifted by anyone who only knows the open password.
  const owner = `${options.password}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  out.encrypt({
    userPassword: options.password,
    ownerPassword: owner,
    permissions: {
      printing: options.allowPrinting === false ? undefined : 'highResolution',
      copying: options.allowCopying ?? false,
      modifying: options.allowEditing ?? false,
      annotating: options.allowEditing ?? false,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: options.allowEditing ?? false,
    },
  });
  return out.save();
}

export async function isPasswordProtected(bytes: Uint8Array): Promise<boolean> {
  return (await loadForReading(bytes)).isEncrypted;
}

/** Removes the password (the user must know it). Output is a clean, unencrypted copy. */
export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes, { password, updateMetadata: false });
  } catch (error) {
    if (error instanceof Error && /password/i.test(error.message)) throw new UserFacingError('That password is incorrect.');
    throw new UserFacingError('This PDF could not be unlocked. It may use an unsupported security method.', error);
  }
  const out = await PDFDocument.create();
  (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
  stampMetadata(out);
  return save(out);
}

/** Crops pages by margins given as fractions (0–0.45) of the displayed page. */
export async function cropPages(bytes: Uint8Array, margins: Margins, pages?: readonly number[]): Promise<Uint8Array> {
  for (const v of Object.values(margins)) if (v < 0 || v > 0.45) throw new UserFacingError('Each crop margin must be between 0% and 45%.');
  if (margins.left + margins.right >= 0.9 || margins.top + margins.bottom >= 0.9) throw new UserFacingError('The crop would leave almost nothing of the page.');
  const doc = await loadForEditing(bytes);
  for (const index of targetPages(doc, pages)) {
    const page = doc.getPage(index);
    const box = pageBox(page);
    const m = displayToUserMargins(margins, box.rotation);
    const x = box.x + m.left * box.width;
    const y = box.y + m.bottom * box.height;
    const w = box.width * (1 - m.left - m.right);
    const h = box.height * (1 - m.top - m.bottom);
    page.setMediaBox(x, y, w, h);
    page.setCropBox(x, y, w, h);
  }
  stampMetadata(doc);
  return save(doc);
}

/**
 * Rebuilds the document by copying every readable page into a fresh file,
 * which regenerates the cross-reference table and drops broken objects.
 */
export async function repairPdf(bytes: Uint8Array): Promise<{ bytes: Uint8Array; pageCount: number }> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes, { ignoreEncryption: false, throwOnInvalidObject: false, updateMetadata: false });
  } catch (error) {
    if (error instanceof Error && /encrypted/i.test(error.message)) throw new UserFacingError('This PDF is password-protected. Unlock it first.');
    throw new UserFacingError('This PDF is too damaged to repair.', error);
  }
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach((p) => out.addPage(p));
  if (pages.length === 0) throw new UserFacingError('No readable pages were found in this PDF.');
  stampMetadata(out);
  return { bytes: await save(out), pageCount: pages.length };
}

// ----- Overlays: signatures, ink, highlights, shapes, text, images ----------

export interface Pt {
  /** Display fractions, origin top-left. */
  x: number;
  y: number;
}

export type Overlay =
  | { type: 'ink'; page: number; strokes: Pt[][]; color: RgbColor; width: number; opacity?: number }
  | { type: 'text'; page: number; at: Pt; text: string; size: number; color: RgbColor }
  | { type: 'rect'; page: number; from: Pt; to: Pt; color: RgbColor; width: number; fill?: RgbColor; opacity?: number }
  | { type: 'ellipse'; page: number; from: Pt; to: Pt; color: RgbColor; width: number }
  | { type: 'line'; page: number; from: Pt; to: Pt; color: RgbColor; width: number; arrow?: boolean }
  | { type: 'image'; page: number; from: Pt; to: Pt; bytes: Uint8Array; mimeType: 'image/png' | 'image/jpeg' };

function pathFromPoints(box: PageBox, points: readonly Pt[], close = false): string {
  // drawSvgPath flips y around its origin; we pass origin (0,0) and negate y so user coords are exact.
  const parts = points.map((p, i) => {
    const u = displayToUser(box, p.x, p.y);
    return `${i === 0 ? 'M' : 'L'}${u.x.toFixed(2)} ${(-u.y).toFixed(2)}`;
  });
  if (points.length === 1) {
    const u = displayToUser(box, points[0].x, points[0].y);
    parts.push(`L${(u.x + 0.01).toFixed(2)} ${(-u.y).toFixed(2)}`);
  }
  return parts.join(' ') + (close ? ' Z' : '');
}

/** Stroke widths are given as a fraction of the displayed page width. */
const strokeWidth = (box: PageBox, fraction: number) => Math.max(0.5, displaySize(box).width * fraction);

export async function applyOverlays(bytes: Uint8Array, overlays: readonly Overlay[]): Promise<Uint8Array> {
  if (overlays.length === 0) throw new UserFacingError('Add something to the page first.');
  const doc = await loadForEditing(bytes);
  let font: PDFFont | null = null;
  for (const o of overlays) {
    assertIndices([o.page], doc.getPageCount());
    const page = doc.getPage(o.page);
    const box = pageBox(page);
    const { width: dw, height: dh } = displaySize(box);
    switch (o.type) {
      case 'ink':
        for (const stroke of o.strokes) {
          if (stroke.length === 0) continue;
          page.drawSvgPath(pathFromPoints(box, stroke), {
            x: 0,
            y: 0,
            borderColor: toRgb(o.color),
            borderWidth: strokeWidth(box, o.width),
            borderOpacity: o.opacity ?? 1,
            borderLineCap: LineCapStyle.Round,
          });
        }
        break;
      case 'line': {
        const pts = [o.from, o.to];
        page.drawSvgPath(pathFromPoints(box, pts), { x: 0, y: 0, borderColor: toRgb(o.color), borderWidth: strokeWidth(box, o.width), borderLineCap: LineCapStyle.Round });
        if (o.arrow) {
          const dx = (o.to.x - o.from.x) * dw;
          const dy = (o.to.y - o.from.y) * dh;
          const len = Math.hypot(dx, dy) || 1;
          const head = Math.min(len * 0.4, dw * 0.04);
          const ux = dx / len;
          const uy = dy / len;
          const wing = (sign: number): Pt => ({
            x: o.to.x + (-ux * head + sign * -uy * head * 0.6) / dw,
            y: o.to.y + (-uy * head + sign * ux * head * 0.6) / dh,
          });
          page.drawSvgPath(pathFromPoints(box, [wing(1), o.to, wing(-1)]), { x: 0, y: 0, borderColor: toRgb(o.color), borderWidth: strokeWidth(box, o.width), borderLineCap: LineCapStyle.Round });
        }
        break;
      }
      case 'rect': {
        const corners: Pt[] = [o.from, { x: o.to.x, y: o.from.y }, o.to, { x: o.from.x, y: o.to.y }];
        page.drawSvgPath(pathFromPoints(box, corners, true), {
          x: 0,
          y: 0,
          borderColor: o.width > 0 ? toRgb(o.color) : undefined,
          borderWidth: o.width > 0 ? strokeWidth(box, o.width) : 0,
          color: o.fill ? toRgb(o.fill) : undefined,
          opacity: o.opacity ?? 1,
          borderOpacity: o.opacity ?? 1,
        });
        break;
      }
      case 'ellipse': {
        const c = displayToUser(box, (o.from.x + o.to.x) / 2, (o.from.y + o.to.y) / 2);
        let rx = (Math.abs(o.to.x - o.from.x) * dw) / 2;
        let ry = (Math.abs(o.to.y - o.from.y) * dh) / 2;
        if (box.rotation % 180 !== 0) [rx, ry] = [ry, rx];
        page.drawEllipse({ x: c.x, y: c.y, xScale: rx, yScale: ry, borderColor: toRgb(o.color), borderWidth: strokeWidth(box, o.width) });
        break;
      }
      case 'text': {
        const text = o.text.trim();
        if (!text) break;
        assertLatin(text);
        font ??= await doc.embedFont(StandardFonts.Helvetica);
        const size = Math.max(4, dw * o.size);
        text.split('\n').forEach((line, i) => {
          // `at` is the top-left of the text box; baseline sits one ascent below.
          drawDisplayText(page, box, line, o.at.x, o.at.y + ((size * 0.9 + i * size * 1.2) / dh), size, font as PDFFont, o.color);
        });
        break;
      }
      case 'image': {
        const image = o.mimeType === 'image/png' ? await doc.embedPng(o.bytes) : await doc.embedJpg(o.bytes);
        const left = Math.min(o.from.x, o.to.x);
        const top = Math.min(o.from.y, o.to.y);
        const right = Math.max(o.from.x, o.to.x);
        const bottom = Math.max(o.from.y, o.to.y);
        // Anchor at the displayed bottom-left corner of the box and rotate with the page.
        const anchor = displayToUser(box, left, bottom);
        const width = (right - left) * dw;
        const height = (bottom - top) * dh;
        page.drawImage(image, { x: anchor.x, y: anchor.y, width, height, rotate: degrees(box.rotation) });
        break;
      }
    }
  }
  stampMetadata(doc);
  return save(doc);
}

// ----- Searchable PDF (OCR text layer) -------------------------------------

export interface TextBlock {
  text: string;
  /** Display fractions of the page: left, top, width, height. */
  box: { x: number; y: number; width: number; height: number };
}

/** Keeps only characters the standard fonts can encode (others are dropped from the hidden layer). */
export function encodableText(text: string): string {
  const bad = new Set(unsupportedCharacters(text));
  return [...text].filter((ch) => !bad.has(ch)).join('');
}

/**
 * Adds an invisible, selectable/searchable text layer from OCR results.
 * Lines are scaled horizontally to span their detected width.
 */
export async function addTextLayer(bytes: Uint8Array, pages: readonly { page: number; lines: TextBlock[] }[]): Promise<Uint8Array> {
  const doc = await loadForEditing(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const { page: index, lines } of pages) {
    assertIndices([index], doc.getPageCount());
    const page = doc.getPage(index);
    const box = pageBox(page);
    const { width: dw, height: dh } = displaySize(box);
    for (const line of lines) {
      const text = encodableText(line.text).trim();
      if (!text) continue;
      const height = line.box.height * dh;
      const size = Math.max(2, height * 0.85);
      const natural = font.widthOfTextAtSize(text, size);
      const target = line.box.width * dw;
      const p = displayToUser(box, line.box.x, line.box.y + line.box.height * 0.82);
      page.drawText(text, {
        x: p.x,
        y: p.y,
        size,
        font,
        opacity: 0,
        rotate: degrees(box.rotation),
        // Horizontal scaling isn't exposed; fall back to spacing via size when needed.
        ...(natural > 0 && Math.abs(natural - target) / target > 0.3 ? { size: Math.max(2, size * (target / natural)) } : {}),
      });
    }
  }
  stampMetadata(doc);
  return save(doc);
}

/**
 * Rebuilds the document, replacing selected pages with flattened images
 * (same displayed size). Used by secure redaction: the original page content —
 * text, vectors, hidden layers — is gone from those pages, not just covered.
 */
export async function replacePagesWithImages(
  bytes: Uint8Array,
  replacements: readonly { page: number; jpeg: Uint8Array }[],
): Promise<Uint8Array> {
  const src = await loadForEditing(bytes);
  assertIndices(replacements.map((r) => r.page), src.getPageCount());
  const byPage = new Map(replacements.map((r) => [r.page, r.jpeg]));
  const out = await PDFDocument.create();
  stampMetadata(out);
  const copies = await out.copyPages(src, src.getPageIndices());
  for (let i = 0; i < copies.length; i += 1) {
    const jpeg = byPage.get(i);
    if (!jpeg) {
      out.addPage(copies[i]);
      continue;
    }
    const { width, height } = displaySize(pageBox(src.getPage(i)));
    const page = out.addPage([width, height]);
    const image = await out.embedJpg(jpeg);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  return save(out);
}

/** Rotates every page (or a subset) — convenience for the Rotate PDF tool. */
export async function rotateAll(bytes: Uint8Array, delta: RotationDelta): Promise<Uint8Array> {
  return rotatePages(bytes, delta);
}

