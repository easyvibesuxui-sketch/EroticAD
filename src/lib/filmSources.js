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

  /**
   * `role` is either 'approach' or 'step:<n>'. A section is one approach and a
   * sequence of actions, and the sequence is usually one long.
   */
  const sourceFor = (index, role) => {
    const section = sections[index]
    if (!section) return null
    if (role === 'approach') return section.approach
    const n = Number(role.slice('step:'.length))
    return section.steps?.[n]?.src ?? null
  }

  const ensure = (index, role) => {
    const src = sourceFor(index, role)
    if (!src) return null
    const key = `${index}:${role}`
    let clip = clips.get(key)
    if (!clip) {
      const el = createElement(src)
      clip = { el, texture: configure(new THREE.VideoTexture(el)), arrived: false }
      // Latched, once. See `ready` below for why it must not be re-read.
      const land = () => {
        clip.arrived = true
      }
      el.addEventListener('loadeddata', land)
      el.addEventListener('canplay', land)
      clips.set(key, clip)
    }
    if (!clip.arrived && clip.el.readyState >= 2) clip.arrived = true
    return clip
  }

  /**
   * Is the whole clip here, not just the front of it?
   *
   * An approach is only ever played, so its first frames are enough to start.
   * An action is only ever *seeked*, and the hand can ask for any moment in it
   * the instant it appears — so for that one, the front of the file is not
   * enough and arming on it means the picture freezes under the hand and then
   * lurches when the rest lands. Measured on a 700kbit connection: section six
   * armed with 1.58s of a 5.38s clip and froze for half the drag.
   */
  const whole = (el) => {
    if (el.readyState >= 4) return true
    const d = el.duration
    if (!Number.isFinite(d) || d <= 0) return false
    const b = el.buffered
    return b.length > 0 && b.end(b.length - 1) >= d - 0.25
  }

  /**
   * Has this clip ever had a frame to show?
   *
   * Deliberately latched rather than read live. `readyState` is not a property
   * of the file, it is a property of the moment: a seek in flight drops it to
   * HAVE_METADATA, and an action clip is *nothing but* seeks — measured at 97%
   * of frames during a turn. Read live, the section spends most of the action
   * believing its own footage is missing and cutting to the stand-in behind it,
   * which is the stock clip flashing in under the hand.
   *
   * A clip that has shown a frame can show one again. The worst a stale latch
   * can do is hold the previous frame a moment longer, which is what a film
   * does anyway.
   */
  const ready = (index, role) => {
    const clip = ensure(index, role)
    if (!clip) return false
    // An approach only has to have started; an action has to be all there.
    return role === 'approach' ? clip.arrived : clip.arrived && whole(clip.el)
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
      role,
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

  /*
   * A section with no footage of its own borrows the shared cut, and its slot
   * in that cut is authored as ten seconds per section: 20 → 28 → 30 for the
   * third, and so on out to a hundred.
   *
   * That only holds if the shared cut is really a hundred seconds long. The
   * development stand-in is a few seconds, so every section past the first
   * asked to play from a point past the end of the file — the playhead clamped
   * short of it, never reached the hold, and the section sat in `playing` for
   * ever: no mark, no action, nothing to finish. So when there is a real file
   * behind this, the slot is laid inside the length it actually has.
   */
  const slotIn = (section) => {
    const d = sharedVideo?.duration
    if (!Number.isFinite(d) || d <= 0.5) {
      return {
        from: section.sharedStart,
        hold: section.sharedAutoplayEnd,
        to: section.sharedScrubEnd,
      }
    }
    const usable = d - 0.1
    // Start each section somewhere else in the file, so ten placeholders do not
    // all open on the same frame.
    const from = ((section.index * 0.13) % 0.34) * usable
    const rest = usable - from
    return { from, hold: from + rest * 0.72, to: from + rest }
  }

  const fallback = (section) =>
    remember(`${section.index}:${sharedVideo ? 'shared' : 'standin'}`, () => ({
      kind: sharedVideo ? 'shared' : 'standin',
      el: sharedVideo,
      texture: sharedVideo ? sharedTexture : standInTexture,
      get playFrom() {
        return slotIn(section).from
      },
      get playTo() {
        return slotIn(section).hold
      },
      get scrubFrom() {
        return slotIn(section).hold
      },
      get scrubTo() {
        return slotIn(section).to
      },
    }))

  const api = {
    /**
     * This section's approach and every action it has, and the next section's
     * approach. Nothing more — a section's clips are opened when the page
     * reaches it, not all forty at once.
     */
    prepare(index) {
      ensure(index, 'approach')
      const steps = sections[index]?.steps ?? []
      for (let n = 0; n < steps.length; n += 1) ensure(index, `step:${n}`)
      ensure(index + 1, 'approach')
    },

    ready,

    /**
     * The picture for a section in a given phase. A clip that has not buffered
     * its first frames is not offered — cutting to it would mean a black frame
     * where the previous one should still be.
     */
    get(index, phase, step = 0) {
      const section = sections[index]
      if (!section) return null

      const role = phase === 'armed' ? `step:${step}` : 'approach'
      const clip = ensure(index, role)
      if (clip && clip.arrived) return clipSource(index, role, clip)

      // The action clip has not arrived yet: hold on the approach's last frame
      // rather than cutting to nothing.
      if (role !== 'approach') {
        const approach = ensure(index, 'approach')
        if (approach && approach.arrived) return clipSource(index, 'approach', approach)
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
