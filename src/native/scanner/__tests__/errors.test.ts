import { friendlyScannerError } from '../systemScanner';

jest.mock('../../../../modules/scanpilot-native', () => ({ ScanPilotNative: null }));

describe('friendlyScannerError', () => {
  it('explains missing Play services and offers photos', () => {
    const e = friendlyScannerError('Google Play services not available', undefined);
    expect(e.reason).toBe('unavailable');
    expect(friendlyScannerError('boom', 'ERR_SCANNER_UNAVAILABLE').reason).toBe('unavailable');
  });

  it('explains the one-time module download', () => {
    expect(friendlyScannerError('Waiting for the document scanner module to be downloaded').message).toMatch(/try again in a minute/);
  });

  it('keeps the native message for anything else', () => {
    const e = friendlyScannerError('Something odd');
    expect(e.reason).toBe('failed');
    expect(e.message).toBe('The scanner could not start. Something odd');
  });
});
