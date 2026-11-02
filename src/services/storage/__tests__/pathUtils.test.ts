import { relativeTo, resolveFrom } from '../pathUtils';

const ROOT = 'file:///data/user/0/app.scanpilot/files/ScanPilot/';

describe('library path helpers', () => {
  it('round-trips paths inside the root', () => {
    const uri = `${ROOT}documents/abc.pdf`;
    const relative = relativeTo(ROOT, uri);
    expect(relative).toBe('documents/abc.pdf');
    expect(resolveFrom(ROOT, relative)).toBe(uri);
  });

  it('handles roots without a trailing slash', () => {
    expect(relativeTo(ROOT.slice(0, -1), `${ROOT}a.pdf`)).toBe('a.pdf');
    expect(resolveFrom(ROOT.slice(0, -1), '/a.pdf')).toBe(`${ROOT}a.pdf`);
  });

  it('leaves URIs outside the root untouched', () => {
    expect(relativeTo(ROOT, 'file:///elsewhere/a.pdf')).toBe('file:///elsewhere/a.pdf');
    expect(resolveFrom(ROOT, 'content://provider/a.pdf')).toBe('content://provider/a.pdf');
  });

  it('survives a container path change (iOS updates)', () => {
    const stored = relativeTo(ROOT, `${ROOT}thumbnails/x.jpg`);
    const newRoot = 'file:///var/mobile/Containers/NEW-UUID/Documents/ScanPilot/';
    expect(resolveFrom(newRoot, stored)).toBe(`${newRoot}thumbnails/x.jpg`);
  });
});
