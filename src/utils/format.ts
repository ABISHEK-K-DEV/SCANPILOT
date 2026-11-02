const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Human-readable byte size, e.g. `1.4 MB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${Number(value.toFixed(digits))} ${UNITS[unit]}`;
}

/** Relative-ish date: "Today, 14:05", "Yesterday", or a short date. */
export function formatDate(timestamp: number, now: number = Date.now()): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (timestamp >= startOfToday) return `Today, ${time}`;
  if (timestamp >= startOfToday - dayMs) return `Yesterday, ${time}`;
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function formatPageCount(count: number | null): string {
  if (count === null) return '— pages';
  return count === 1 ? '1 page' : `${count} pages`;
}
