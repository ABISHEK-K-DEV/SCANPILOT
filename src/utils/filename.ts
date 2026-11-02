// Characters that are invalid on at least one of Android/iOS/Windows file systems.
const INVALID_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;
export const MAX_NAME_LENGTH = 120;

/** Strips a trailing extension such as `.pdf` or `.jpeg`. */
export function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]{1,5}$/i, '');
}

/**
 * Produces a safe display name for a document. Returns `fallback` when the
 * input is empty after sanitising.
 */
export function sanitizeDocumentName(input: string, fallback = 'Untitled'): string {
  const cleaned = input
    .replace(INVALID_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Validation for rename / create-folder dialogs. Returns an error message or null. */
export function validateName(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return 'Name cannot be empty.';
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  if (/[\\/:*?"<>|]/.test(trimmed)) return 'Name cannot contain \\ / : * ? " < > |';
  return null;
}

/** File name to use when exporting/sharing, e.g. `Invoice March.pdf`. */
export function exportFileName(displayName: string, extension = 'pdf'): string {
  return `${sanitizeDocumentName(displayName)}.${extension}`;
}

/** "Scan 2026-11-02 14.05" style default names. */
export function timestampedName(prefix: string, date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}.${pad(date.getMinutes())}`;
}

/** Appends " (2)", " (3)"… until `isTaken` returns false. */
export function uniqueName(base: string, isTaken: (candidate: string) => boolean): string {
  if (!isTaken(base)) return base;
  const match = /^(.*) \((\d+)\)$/.exec(base);
  const stem = match ? match[1] : base;
  let n = match ? Number(match[2]) + 1 : 2;
  while (isTaken(`${stem} (${n})`)) n += 1;
  return `${stem} (${n})`;
}
