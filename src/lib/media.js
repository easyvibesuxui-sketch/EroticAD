/**
 * Media sources.
 *
 * Every entry is a list of candidates tried in order. Local files win, so the
 * production drop is: put the real cut at `public/media/scene.mp4`, the track
 * at `public/media/track.mp3`, the breath layer at `public/media/breath.mp3`,
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

export const MEDIA = {
  video: [
    '/media/scene.mp4',
    'https://mdn.github.io/shared-assets/videos/flower.mp4',
    'https://vjs.zencdn.net/v/oceans.mp4',
  ],
  music: [
    '/media/track.mp3',
    'https://mdn.github.io/webaudio-examples/audio-basics/outfoxing.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  ],
  breath: [
    '/media/breath.mp3',
    'https://mdn.github.io/webaudio-examples/audio-basics/outfoxing.mp3',
  ],
}

/** How long to wait on a candidate before writing it off. */
export const LOAD_TIMEOUT_MS = 4500
