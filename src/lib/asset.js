/**
 * Where the site's own files live.
 *
 * Served from a domain root, `/media/track.mp3` is the whole story. On GitHub
 * Pages the site lives under `/<repo>/`, and that same leading slash points at
 * the wrong host root — the page loads and every clip 404s. Vite knows the
 * deploy base at build time, so ask it rather than hard-coding a repo name.
 *
 * Only site-relative paths are re-rooted. Absolute URLs (the development
 * stand-ins) and the data URIs a single-file build injects are already
 * complete and pass through untouched.
 */
const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '')

export const asset = (path) =>
  typeof path === 'string' && path.startsWith('/') ? BASE + path : path
