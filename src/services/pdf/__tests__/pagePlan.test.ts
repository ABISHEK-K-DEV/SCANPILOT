import { deleteSelected, duplicateSelected, initialPlan, isUnchanged, moveSelected, rotateSelected } from '../pagePlan';
import { describePages, parseRangeGroups } from '../pageRanges';

const src = (plan: { sourceIndex: number }[]) => plan.map((p) => p.sourceIndex);

describe('page plan (organiser)', () => {
  it('starts unchanged', () => {
    const plan = initialPlan(3);
    expect(src(plan)).toEqual([0, 1, 2]);
    expect(isUnchanged(plan, 3)).toBe(true);
    expect(new Set(plan.map((p) => p.key)).size).toBe(3);
  });

  it('rotates only selected pages and normalises angles', () => {
    const plan = initialPlan(3);
    const sel = new Set([plan[1].key]);
    const r = rotateSelected(rotateSelected(plan, sel, -90), sel, -90);
    expect(r.map((p) => p.rotate)).toEqual([0, 180, 0]);
    expect(isUnchanged(r, 3)).toBe(false);
  });

  it('deletes and duplicates selected pages', () => {
    const plan = initialPlan(4);
    const sel = new Set([plan[0].key, plan[2].key]);
    expect(src(deleteSelected(plan, sel))).toEqual([1, 3]);
    const dup = duplicateSelected(plan, sel);
    expect(src(dup.plan)).toEqual([0, 0, 1, 2, 2, 3]);
    expect(dup.added).toHaveLength(2);
  });

  it('moves a selection as a block and stops at the edges', () => {
    const plan = initialPlan(5);
    const sel = new Set([plan[1].key, plan[2].key]);
    expect(src(moveSelected(plan, sel, -1))).toEqual([1, 2, 0, 3, 4]);
    expect(src(moveSelected(plan, sel, 1))).toEqual([0, 3, 1, 2, 4]);
    const edge = new Set([plan[0].key, plan[3].key]);
    expect(src(moveSelected(plan, edge, -1))).toEqual([0, 1, 3, 2, 4]);
    const end = new Set([plan[4].key]);
    expect(src(moveSelected(plan, end, 1))).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('range groups (split)', () => {
  it('turns each comma part into one output', () => {
    expect(parseRangeGroups('1-3, 4-5, 7-', 8)).toEqual([[0, 1, 2], [3, 4], [6, 7]]);
    expect(() => parseRangeGroups('9', 8)).toThrow('outside');
    expect(() => parseRangeGroups(' , ', 8)).toThrow('at least one');
  });

  it('describes pages for file names', () => {
    expect(describePages([3])).toBe('page 4');
    expect(describePages([0, 1, 2, 6])).toBe('pages 1-3, 7');
  });
});
