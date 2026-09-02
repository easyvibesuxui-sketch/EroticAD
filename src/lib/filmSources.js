import * as THREE from 'three'

/**
 * Where each section's picture comes from.
 *
 * The film is delivered one file per setup, not as one long cut, because that
 * is how it is shot: ten locked-off takes, each its own eight seconds of
 * approach and two of action. A section therefore asks for *its* clip, and only
 * falls back — to a shared cut if one exists, then to the procedural stand-in —
 * while its own is still arriving, or if it was never supplied.
 *
 * The resolved source carries the timings with it, because they differ: inside
 * its own clip a section starts at zero, inside a shared cut it starts at its
 * slot. Everything above this just reads `start`, `autoplayEnd`, `scrubEnd` and
 * never has to know which case it got.
 *
 * Clips are fetched one section ahead and no further. Ten 720p files opening at
 * once would saturate the connection to show one of them.
 */

function configure(texture) {
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * A detached <video> decodes fine in Chrome, but Safari on iOS has a long
 * history of refusing to play elements that are not in the document. They live
 * in a 1px hidden host instead of nowhere — out of the way, but present.
 */
function mediaHost() {
  let host = document.getElementById('film-sources')
  if (host) return host
  host = document.createElement('div')
  host.id = 'film-sources'
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
  })
  document.body.appendChild(host)
  return host
}

function createElement(src) {
  const el = document.createElement('video')
  el.crossOrigin = 'anonymous'
  el.muted = true
  el.defaultMuted = true
  el.loop = false
  el.playsInline = true
  el.setAttribute('playsinline', '')
  el.setAttribute('webkit-playsinline', '')
  el.preload = 'auto'
  el.disablePictureInPicture = true
  el.src = src
  mediaHost().appendChild(el)
  el.load()
  return el
}

export function createFilmSources({ sections, sharedVideo = null, standIn = null }) {
  const own = new Map()
  // `get` runs every frame; the resolved objects are cached so it allocates
  // nothing once a section has settled on a source.
  const resolved = new Map()

  const sharedTexture = sharedVideo ? configure(new THREE.VideoTexture(sharedVideo)) : null
  const standInTexture = standIn ? configure(new THREE.CanvasTexture(standIn.canvas)) : null

  const ensure = (index) => {
    const section = sections[index]
    if (!section?.src) return null
    let entry = own.get(index)
    if (!entry) {
      const el = createElement(section.src)
      entry = { el, texture: configure(new THREE.VideoTexture(el)) }
      own.set(index, entry)
    }
    return entry
  }

  const remember = (key, value) => {
    const cached = resolved.get(key)
    if (cached) return cached
    resolved.set(key, value)
    return value
  }

  const fallback = (section) => {
    const key = `${section.index}:${sharedVideo ? 'shared' : 'standin'}`
    const cached = resolved.get(key)
    if (cached) return cached
    if (sharedVideo) {
      return remember(key, {
        kind: 'shared',
        el: sharedVideo,
        texture: sharedTexture,
        start: section.sharedStart,
        autoplayEnd: section.sharedAutoplayEnd,
        scrubEnd: section.sharedScrubEnd,
      })
    }
    return remember(key, {
      kind: 'standin',
      el: null,
      texture: standInTexture,
      start: section.sharedStart,
      autoplayEnd: section.sharedAutoplayEnd,
      scrubEnd: section.sharedScrubEnd,
    })
  }

  return {
    /** Open this section's clip and the next one's, and nothing else. */
    prepare(index) {
      ensure(index)
      ensure(index + 1)
    },

    /**
     * The picture for a section right now. A clip that has not buffered its
     * first frames is not offered yet — showing it would mean a black frame
     * where the previous section's last one should still be.
     */
    get(index) {
      const section = sections[index]
      if (!section) return null
      const entry = ensure(index)
      if (entry && entry.el.readyState >= 2) {
        return remember(`${index}:own`, {
          kind: 'own',
          el: entry.el,
          texture: entry.texture,
          start: section.ownStart,
          autoplayEnd: section.ownAutoplayEnd,
          scrubEnd: section.ownScrubEnd,
        })
      }
      return fallback(section)
    },

    dispose() {
      for (const { el, texture } of own.values()) {
        texture.dispose()
        try {
          el.pause()
          el.removeAttribute('src')
          el.load()
        } catch {
          /* element already gone */
        }
      }
      own.clear()
      resolved.clear()
      document.getElementById('film-sources')?.remove()
      sharedTexture?.dispose()
      standInTexture?.dispose()
    },
  }
}
