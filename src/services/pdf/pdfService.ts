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
import { degrees, PDFDocument, type PDFPage } from 'pdf-lib';

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

    if (pageSize === 'fit' || pageSize === 'receipt') {
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
