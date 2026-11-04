/**
 * Parses a human page-range expression such as `1-3, 5, 8-` into zero-based
 * page indices. Pages are 1-based in the expression. Throws on invalid input.
 */
export function parsePageRanges(expression: string, pageCount: number): number[] {
  const trimmed = expression.trim();
  if (trimmed.length === 0) throw new Error('Enter at least one page or range.');
  const result: number[] = [];
  const seen = new Set<number>();
  for (const rawPart of trimmed.split(',')) {
    const part = rawPart.trim();
    if (part.length === 0) continue;
    const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part);
    if (!match || (!match[1] && !match[3])) throw new Error(`"${part}" is not a valid page range.`);
    const start = match[1] ? Number(match[1]) : 1;
    const end = match[2] ? (match[3] ? Number(match[3]) : pageCount) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`"${part}" is outside the document (1–${pageCount}).`);
    }
    if (start > end) throw new Error(`"${part}" starts after it ends.`);
    for (let page = start; page <= end; page += 1) {
      const index = page - 1;
      if (!seen.has(index)) {
        seen.add(index);
        result.push(index);
      }
    }
  }
  if (result.length === 0) throw new Error('Enter at least one page or range.');
  return result;
}

/** Formats zero-based indices back into a compact 1-based expression. */
export function formatPageRanges(indices: readonly number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1;
    parts.push(i === j ? `${sorted[i] + 1}` : `${sorted[i] + 1}-${sorted[j] + 1}`);
    i = j + 1;
  }
  return parts.join(', ');
}

/**
 * Parses comma-separated ranges where each part becomes its own group, e.g.
 * `1-3, 4-6, 7-` → [[0,1,2],[3,4,5],[6..]]. Used by "Split by ranges".
 */
export function parseRangeGroups(expression: string, pageCount: number): number[][] {
  const parts = expression
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) throw new Error('Enter at least one page or range.');
  return parts.map((part) => parsePageRanges(part, pageCount));
}

/** Human label for a group of zero-based pages: "page 4" or "pages 1-3, 7". */
export function describePages(indices: readonly number[]): string {
  return indices.length === 1 ? `page ${indices[0] + 1}` : `pages ${formatPageRanges(indices)}`;
}
