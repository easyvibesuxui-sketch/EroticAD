import { asset } from './asset.js'

/**
 * Media sources.
 *
 * Every entry is a list of candidates tried in order. Local files win, so the
 * production drop is: put the real cut at `public/media/scene.mp4` and the
 * track at `public/media/track.mp3`, and change nothing else.
 *
 * The remote entries are free stock stand-ins for development only. They must
 * be served with CORS headers (`Access-Control-Allow-Origin`), because a
 * cross-origin video without them cannot be uploaded into a WebGL texture and
 * a cross-origin track without them cannot be routed through the filter graph.
 *
 * If every candidate fails — offline, blocked host, dead link — the app does
 * not break: `standin.js` paints a procedural body-in-candlelight into the
 * shader and `AudioEngine` synthesises its own bass bed. The whole mechanic
 * stays demoable with no assets at all.
 */

/**
 * A single-file build has no origin to serve `/media/` from, so it injects its
 * assets as data URIs on `window.__EROTICAD_MEDIA` before the app boots. They
 * take priority over everything else; when the global is absent — which is the
 * normal, served case — this list is unchanged.
 */
const injected = (typeof window !== 'undefined' && window.__EROTICAD_MEDIA) || {}

export const MEDIA = {
  video: [
    ...(injected.video || []),
    asset('/media/scene.mp4'),
    'https://mdn.github.io/shared-assets/videos/flower.mp4',
    'https://vjs.zencdn.net/v/oceans.mp4',
  ],
  /*
   * The only sound on the site: one track, looping, under everything. It gets
   * no stock stand-in — a borrowed song is not this one, and "only this audio"
   * is better served by silence than by a substitute.
   */
  music: [...(injected.music || []), asset('/media/track.mp3')],
}

/** How long to wait on a candidate before writing it off. */
export const LOAD_TIMEOUT_MS = 4500
