import type { PagePlanEntry } from './pdfService';

/** Editable page list for the organiser. `key` is stable across moves for React lists and selection. */
export interface PlanPage extends PagePlanEntry {
  key: string;
  rotate: number;
}

let keySeed = 0;
const nextKey = () => `p${(keySeed += 1)}`;

export function initialPlan(pageCount: number): PlanPage[] {
  return Array.from({ length: pageCount }, (_, i) => ({ key: nextKey(), sourceIndex: i, rotate: 0 }));
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

export function rotateSelected(plan: readonly PlanPage[], selected: ReadonlySet<string>, delta: 90 | -90): PlanPage[] {
  return plan.map((p) => (selected.has(p.key) ? { ...p, rotate: norm(p.rotate + delta) } : p));
}

export function deleteSelected(plan: readonly PlanPage[], selected: ReadonlySet<string>): PlanPage[] {
  return plan.filter((p) => !selected.has(p.key));
}

/** Inserts a copy right after each selected page. Returns the new plan and the keys of the copies. */
export function duplicateSelected(plan: readonly PlanPage[], selected: ReadonlySet<string>): { plan: PlanPage[]; added: string[] } {
  const next: PlanPage[] = [];
  const added: string[] = [];
  for (const p of plan) {
    next.push(p);
    if (selected.has(p.key)) {
      const copy = { ...p, key: nextKey() };
      next.push(copy);
      added.push(copy.key);
    }
  }
  return { plan: next, added };
}

/**
 * Moves every selected page one step earlier (-1) or later (+1), keeping
 * their relative order; pages already at the edge stay put.
 */
export function moveSelected(plan: readonly PlanPage[], selected: ReadonlySet<string>, delta: -1 | 1): PlanPage[] {
  const next = [...plan];
  const indices = next.map((p, i) => (selected.has(p.key) ? i : -1)).filter((i) => i >= 0);
  const order = delta < 0 ? indices : [...indices].reverse();
  const blocked = new Set<number>();
  for (const i of order) {
    const j = i + delta;
    if (j < 0 || j >= next.length || blocked.has(j)) {
      blocked.add(i);
      continue;
    }
    if (selected.has(next[j].key) && blocked.has(j)) {
      blocked.add(i);
      continue;
    }
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function isUnchanged(plan: readonly PlanPage[], pageCount: number): boolean {
  return plan.length === pageCount && plan.every((p, i) => p.sourceIndex === i && p.rotate === 0);
}
