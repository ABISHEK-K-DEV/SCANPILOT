import { decodeBase64 } from '../documentCamera';

describe('decodeBase64', () => {
  it('decodes padded and unpadded input like Buffer does', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 255, 1000]) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) & 255);
      const b64 = Buffer.from(bytes).toString('base64');
      expect(Array.from(decodeBase64(b64))).toEqual(Array.from(bytes));
    }
  });
});
