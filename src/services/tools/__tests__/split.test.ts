import { planSplit } from '../splitService';

jest.mock('@/services/library/documentService', () => ({}));
jest.mock('@/services/storage/fileStore', () => ({}));

describe('planSplit', () => {
  it('plans every-page, range and extract splits', () => {
    expect(planSplit({ kind: 'each' }, 3)).toEqual([[0], [1], [2]]);
    expect(planSplit({ kind: 'ranges', expression: '1-2, 3' }, 3)).toEqual([[0, 1], [2]]);
    expect(planSplit({ kind: 'extract', expression: '3, 1' }, 3)).toEqual([[2, 0]]);
    expect(() => planSplit({ kind: 'ranges', expression: '5' }, 3)).toThrow('outside');
  });
});
