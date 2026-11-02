import { insertPages, movePage, orphanedFiles, removePage, replacePage, selectionAfterRemove } from '../sessionReducer';
import type { ScanPage } from '../types';

const page = (id: string, uri = `${id}.jpg`, originalUri = uri): ScanPage => ({
  id,
  uri,
  originalUri,
  width: 10,
  height: 10,
  originalWidth: 10,
  originalHeight: 10,
});

const ids = (pages: ScanPage[]) => pages.map((p) => p.id);
const abc = [page('a'), page('b'), page('c')];

describe('scan session reducer', () => {
  it('inserts at the end or after a given index', () => {
    expect(ids(insertPages(abc, [page('x')]))).toEqual(['a', 'b', 'c', 'x']);
    expect(ids(insertPages(abc, [page('x'), page('y')], 0))).toEqual(['a', 'x', 'y', 'b', 'c']);
  });

  it('moves pages and clamps at the ends', () => {
    expect(ids(movePage(abc, 'c', -1))).toEqual(['a', 'c', 'b']);
    expect(ids(movePage(abc, 'a', -1))).toEqual(['a', 'b', 'c']);
    expect(ids(movePage(abc, 'a', 5))).toEqual(['b', 'c', 'a']);
  });

  it('removes pages and picks a sensible next selection', () => {
    expect(ids(removePage(abc, 'b'))).toEqual(['a', 'c']);
    expect(selectionAfterRemove(abc, 'b')).toBe('c');
    expect(selectionAfterRemove(abc, 'c')).toBe('b');
    expect(selectionAfterRemove([page('a')], 'a')).toBeNull();
  });

  it('replaces page fields but never the id', () => {
    const next = replacePage(abc, 'b', { uri: 'b2.jpg', id: 'hijack' } as Partial<ScanPage>);
    expect(next[1]).toMatchObject({ id: 'b', uri: 'b2.jpg', originalUri: 'b.jpg' });
  });

  it('reports files no longer referenced so they can be deleted', () => {
    const edited = replacePage(abc, 'a', { uri: 'a-crop.jpg' });
    expect(orphanedFiles(abc, edited)).toEqual([]); // original kept for reset
    const reset = replacePage(edited, 'a', { uri: 'a.jpg' });
    expect(orphanedFiles(edited, reset)).toEqual(['a-crop.jpg']);
    expect(orphanedFiles(abc, removePage(abc, 'b'))).toEqual(['b.jpg']);
  });
});
