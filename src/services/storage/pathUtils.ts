/** Pure path helpers (no native imports) so they can be unit-tested. */

export function withTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

/** Returns `uri` relative to `rootUri`, or `uri` unchanged when it lies outside the root. */
export function relativeTo(rootUri: string, uri: string): string {
  const root = withTrailingSlash(rootUri);
  return uri.startsWith(root) ? uri.slice(root.length) : uri;
}

/** Resolves a stored path against `rootUri`; absolute URIs are returned unchanged. */
export function resolveFrom(rootUri: string, path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return `${withTrailingSlash(rootUri)}${path.replace(/^\/+/, '')}`;
}
