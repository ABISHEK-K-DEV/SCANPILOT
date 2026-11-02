import type { SortOption } from '@/types/document';

export interface SortChoice {
  key: string;
  label: string;
  sort: SortOption;
}

export const SORT_CHOICES: readonly SortChoice[] = [
  { key: 'date-desc', label: 'Newest first', sort: { field: 'date', direction: 'desc' } },
  { key: 'date-asc', label: 'Oldest first', sort: { field: 'date', direction: 'asc' } },
  { key: 'name-asc', label: 'Name (A–Z)', sort: { field: 'name', direction: 'asc' } },
  { key: 'name-desc', label: 'Name (Z–A)', sort: { field: 'name', direction: 'desc' } },
  { key: 'size-desc', label: 'Largest first', sort: { field: 'size', direction: 'desc' } },
  { key: 'size-asc', label: 'Smallest first', sort: { field: 'size', direction: 'asc' } },
  { key: 'opened-desc', label: 'Recently opened', sort: { field: 'opened', direction: 'desc' } },
];

export function sortLabel(sort: SortOption): string {
  return SORT_CHOICES.find((c) => c.sort.field === sort.field && c.sort.direction === sort.direction)?.label ?? 'Custom';
}
