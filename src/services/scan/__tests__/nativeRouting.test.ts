/**
 * The camera pipeline must use the native page processor when it exists:
 * per-pixel JavaScript on Hermes took 20–30 s per photo on real phones.
 */
import { filterImage, processCapturedPage } from '../pageProcessing';
import type { ScanPage } from '../types';

const mockProcess = jest.fn();
let mockNativeAvailable = true;
const mockDecode = jest.fn();

jest.mock('@/native/pageProcessor', () => ({
  getNativePageProcessor: () => (mockNativeAvailable ? { process: mockProcess } : null),
}));
jest.mock('jpeg-js', () => ({ decode: (...args: unknown[]) => mockDecode(...args) }));
jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    exists = true;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    async bytes() {
      return new Uint8Array();
    }
    create() {}
    delete() {}
    async write() {}
    async move() {}
  }
  class MockDirectory extends MockFile {
    override create() {}
  }
  return { File: MockFile, Directory: MockDirectory };
});
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize() {},
      renderAsync: async () => ({ width: 320, height: 240, saveAsync: async () => ({ uri: 'file:///small.jpg', width: 320, height: 240 }) }),
    }),
  },
}));
jest.mock('@/services/storage/paths', () => ({ tempDir: () => ({ uri: 'file:///tmp' }) }));
// Detection: report a page so the quad path is exercised.
jest.mock('../detect', () => ({
  rgbaToGray: () => new Uint8Array(),
  detectDocumentQuad: () => ({ quad: [{ x: 10, y: 10 }, { x: 300, y: 12 }, { x: 310, y: 230 }, { x: 8, y: 228 }] }),
}));

const page: ScanPage = { id: 'p', uri: 'file:///photo.jpg', width: 3200, height: 2400, originalUri: 'file:///photo.jpg', originalWidth: 3200, originalHeight: 2400 };

beforeEach(() => {
  jest.clearAllMocks();
  mockNativeAvailable = true;
  // Small decode used for detection only.
  mockDecode.mockReturnValue({ width: 320, height: 240, data: new Uint8Array(320 * 240 * 4) });
  mockProcess.mockResolvedValue({ baseUri: 'file:///base.jpg', baseWidth: 2400, baseHeight: 1700, uri: 'file:///filtered.jpg', width: 2400, height: 1700 });
});

describe('native page processing', () => {
  it('runs warp + filter for a captured photo in one native call (no full-size JS decode)', async () => {
    const out = await processCapturedPage(page, 'clarity');
    expect(mockProcess).toHaveBeenCalledTimes(1);
    const args = mockProcess.mock.calls[0][0];
    expect(args.filter).toBe('clarity');
    expect(args.quad).toHaveLength(8);
    expect(args.quad[0]).toBeCloseTo(100); // detection preview scaled back to 3200 px
    expect(args.baseOutput).toMatch(/\.jpg$/);
    // Only the 320 px detection preview was decoded in JS.
    expect(mockDecode).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ uri: 'file:///filtered.jpg', filter: 'clarity', base: { uri: 'file:///base.jpg' } });
  });

  it('keeps the warped page when the filter is "original"', async () => {
    mockProcess.mockResolvedValue({ baseUri: 'file:///base.jpg', baseWidth: 2400, baseHeight: 1700 });
    const out = await processCapturedPage(page, 'original');
    expect(mockProcess.mock.calls[0][0].filteredOutput).toBeNull();
    expect(out.uri).toBe('file:///base.jpg');
    expect(out.base).toBeUndefined();
  });

  it('changes filters natively from the review screen', async () => {
    const out = await filterImage('file:///base.jpg', 'bw');
    expect(mockProcess).toHaveBeenCalledWith(expect.objectContaining({ input: 'file:///base.jpg', quad: null, filter: 'bw' }));
    expect(out.uri).toBe('file:///filtered.jpg');
    expect(mockDecode).not.toHaveBeenCalled();
  });

  it('falls back to the JS pipeline where the native module is missing', async () => {
    mockNativeAvailable = false;
    await processCapturedPage(page, 'original').catch(() => undefined);
    expect(mockProcess).not.toHaveBeenCalled();
    expect(mockDecode.mock.calls.length).toBeGreaterThanOrEqual(2); // detection + full-size decode
  });
});
