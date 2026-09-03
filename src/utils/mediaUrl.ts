import { API_ORIGIN } from '@services/api.client';
import { session } from '@services/storage';

/**
 * A stored file's URL, re-rooted onto the app's configured origin.
 *
 * The backend stamps an absolute URL against whatever host it answered on — in
 * production that is the server's own internal address (`http://…:4000/uploads/…`),
 * which a handset cannot reach. Any of our own `/uploads/…` paths are therefore
 * re-based onto `API_ORIGIN` (`https://api.simhadritransport.com`), so the image
 * loads from the same public host the rest of the app talks to. A file already
 * served from a public CDN domain has no `/uploads/` segment and is left alone.
 *
 * This is the helper the customer and driver apps already carry; the admin app
 * was missing it, which is why its document scans and photos would not load.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }
  const marker = '/uploads/';
  const at = url.indexOf(marker);
  if (at >= 0) {
    return `${API_ORIGIN}${url.slice(at)}`;
  }
  if (url.startsWith('/')) {
    return `${API_ORIGIN}${url}`;
  }
  return url;
}

/**
 * An `<Image source>` for a stored file: the resolved URL plus the session
 * token. `/uploads` serves to a signed link *or* a bearer token, and an avatar
 * stored raw carries no signature, so the token is what lets it load. A public
 * CDN URL ignores the header and loads on the URL alone.
 */
export function authedImageSource(
  url?: string | null,
): { uri: string; headers?: Record<string, string> } | undefined {
  const uri = resolveMediaUrl(url);
  if (!uri) {
    return undefined;
  }
  const token = session.getToken();
  return token ? { uri, headers: { Authorization: `Bearer ${token}` } } : { uri };
}

/**
 * Whether a stored file is an image we can show inline, as opposed to a PDF or
 * anything else the OS has to open. Judged by extension across the name and the
 * URL — a signed link keeps the extension ahead of its query string, so the
 * `(\?|$)` tail matches it whether the URL is bare or signed.
 *
 * The single copy of the test the whole app shares: it was written out inline
 * on the booking screen, and a document is "an image" the same way everywhere.
 */
export function isImageDoc(url?: string | null, name?: string | null): boolean {
  const src = `${name ?? ''} ${url ?? ''}`.toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|$)/.test(src);
}
