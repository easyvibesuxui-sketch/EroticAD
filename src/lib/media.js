import { asset } from './asset.js'

/**
 * Media sources.
 *
 * Every entry is a list of candidates tried in order. Local files win, so the
 * production drop is: put the real cut at `public/media/scene.mp4`, the track
 * at `public/media/track.mp3`, the second audio at `public/media/after.mp3`,
 * and change nothing else.
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
   * The music, and the only music. There is deliberately no stand-in behind
   * it: a borrowed song is not this one, and the site playing something else
   * because a file failed would be worse than the site playing nothing. The
   * sound design around it — the veil, the heart, the tape, the chime, the
   * breath — is synthesised in the graph and needs no files at all.
   */
  music: [...(injected.music || []), asset('/media/track.mp3')],
  /*
   * The second audio: the one that belongs to the end of a section, after the
   * mark has been drawn all the way. It is a cue, not a bed — so unlike the
   * track it gets no stock stand-in, because a borrowed song firing the moment
   * a piece comes off would be worse than the breath the engine synthesises
   * for itself when this file is absent.
   */
  after: [...(injected.after || []), asset('/media/after.mp3')],
}

/** How long to wait on a candidate before writing it off. */
export const LOAD_TIMEOUT_MS = 4500
