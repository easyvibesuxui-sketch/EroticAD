import * as THREE from 'three'

/**
 * Where each section's picture comes from.
 *
 * A section arrives as two files. The **approach** plays itself and ends; the
 * **action** is the last couple of seconds and is never played at all, only
 * addressed frame by frame by the hand. Splitting them removes the timing
 * question entirely — there is no hold point to locate, because the approach
 * simply runs out — and lets each be encoded for what it does. The approach is
 * never seeked, so it takes an ordinary GOP. The action is nothing but seeking,
 * so it ships all-intra: every frame is a keyframe, and a drag in either
 * direction costs exactly one decode.
 *
 * A section with no pair falls back to a shared cut if one exists, and to the
 * procedural stand-in if not, where its slot is described by time offsets
 * instead. The resolved source carries whichever applies, so nothing above here
 * has to know which case it got.
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
  const clips = new Map() // `${index}:${role}` -> { el, texture }
  const resolved = new Map()

  const sharedTexture = sharedVideo ? configure(new THREE.VideoTexture(sharedVideo)) : null
  const standInTexture = standIn ? configure(new THREE.CanvasTexture(standIn.canvas)) : null

  const ensure = (index, role) => {
    const src = sections[index]?.[role]
    if (!src) return null
    const key = `${index}:${role}`
    let clip = clips.get(key)
    if (!clip) {
      const el = createElement(src)
      clip = { el, texture: configure(new THREE.VideoTexture(el)) }
      clips.set(key, clip)
    }
    return clip
  }

  const ready = (index, role) => {
    const clip = ensure(index, role)
    return Boolean(clip && clip.el.readyState >= 2)
  }

  const remember = (key, build) => {
    let value = resolved.get(key)
    if (!value) {
      value = build()
      resolved.set(key, value)
    }
    return value
  }

  const clipSource = (index, role, clip) =>
    remember(`${index}:${role}`, () => ({
      kind: role,
      el: clip.el,
      texture: clip.texture,
      playFrom: 0,
      scrubFrom: 0,
      // Duration is NaN until metadata lands. Until then the clip reads as
      // endless, so the approach cannot arm on a frame it has not reached.
      get playTo() {
        return Number.isFinite(clip.el.duration) ? clip.el.duration : Infinity
      },
      get scrubTo() {
        return Number.isFinite(clip.el.duration) ? clip.el.duration : 0
      },
    }))

  const fallback = (section) =>
    remember(`${section.index}:${sharedVideo ? 'shared' : 'standin'}`, () => ({
      kind: sharedVideo ? 'shared' : 'standin',
      el: sharedVideo,
      texture: sharedVideo ? sharedTexture : standInTexture,
      playFrom: section.sharedStart,
      playTo: section.sharedAutoplayEnd,
      scrubFrom: section.sharedAutoplayEnd,
      scrubTo: section.sharedScrubEnd,
    }))

  const api = {
    /** This section's two clips, and the next section's approach. Nothing more. */
    prepare(index) {
      ensure(index, 'approach')
      ensure(index, 'action')
      ensure(index + 1, 'approach')
    },

    ready,

    /**
     * The picture for a section in a given phase. A clip that has not buffered
     * its first frames is not offered — cutting to it would mean a black frame
     * where the previous one should still be.
     */
    get(index, phase) {
      const section = sections[index]
      if (!section) return null

      const role = phase === 'armed' ? 'action' : 'approach'
      const clip = ensure(index, role)
      if (clip && clip.el.readyState >= 2) return clipSource(index, role, clip)

      // The action clip has not arrived yet: hold on the approach's last frame
      // rather than cutting to nothing.
      if (role === 'action') {
        const approach = ensure(index, 'approach')
        if (approach && approach.el.readyState >= 2) {
          return clipSource(index, 'approach', approach)
        }
      }
      return fallback(section)
    },

    dispose() {
      for (const { el, texture } of clips.values()) {
        texture.dispose()
        try {
          el.pause()
          el.removeAttribute('src')
          el.load()
        } catch {
          /* element already gone */
        }
      }
      clips.clear()
      resolved.clear()
      document.getElementById('film-sources')?.remove()
      sharedTexture?.dispose()
      standInTexture?.dispose()
    },
  }

  return api
}
