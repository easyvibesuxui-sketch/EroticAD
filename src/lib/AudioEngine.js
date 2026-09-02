/*
 *  THE SOUND
 *  ---------
 *  One track, looping, and nothing else.
 *
 *  There was a room here once: a low-pass the whole bed lived behind, a
 *  heartbeat on the same clock as the shader, tape noise under the scrub, a
 *  chime on the commit and a breath layer over the top. It is all gone. The
 *  brief is one piece of music playing under the whole site — every other
 *  sound was competing with it, and a shop with ten actions in it does not
 *  need nine of them announced.
 *
 *  So this is a player, not an engine: an `<audio>` element on loop, a master
 *  gain to fade it in and to mute it without a click, and no processing on the
 *  way through. If the track will not load, the site is silent, which is the
 *  honest outcome of "only this audio, nothing else".
 */

/** Where the track sits when it is playing. */
const LEVEL = 0.85

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.ready = false
    this.muted = false
    this.el = null
  }

  /**
   * Open the context. This has to run *synchronously* inside the user gesture
   * — awaiting the media load first would spend the activation and leave the
   * context suspended on Safari.
   */
  prime() {
    if (this.ctx) return this.ctx
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    this.ctx = new Ctx({ latencyHint: 'interactive' })
    this.ctx.resume().catch(() => {})
    return this.ctx
  }

  /**
   * Start the track.
   *
   * The graph is a gain and nothing else. It exists at all because the mute
   * has to ramp — cutting an element's volume to zero in one sample is an
   * audible click — and because a shared context is what keeps the fade and
   * the element on the same clock. If the routing is refused (almost always a
   * CORS refusal on the element), the element plays on its own instead: worse
   * mute, still the track.
   */
  async start({ musicEl = null } = {}) {
    if (this.ready) return
    this.el = musicEl
    if (!musicEl) return

    musicEl.loop = true

    const ctx = this.prime()
    if (ctx) {
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
      try {
        const master = ctx.createGain()
        master.gain.value = 0.0001
        master.connect(ctx.destination)
        ctx.createMediaElementSource(musicEl).connect(master)
        this.master = master
      } catch {
        this.master = null
      }
    }

    musicEl.volume = this.master ? 1 : this.muted ? 0 : LEVEL
    await musicEl.play().catch(() => {})

    // Fade in rather than slamming the door open — unless the sound was
    // switched off while the track was still loading.
    if (this.master) {
      const now = this.ctx.currentTime
      this.master.gain.setValueAtTime(0.0001, now)
      if (!this.muted) this.master.gain.exponentialRampToValueAtTime(LEVEL, now + 2.6)
    }

    this.ready = true
  }

  /**
   * Called once a frame by the render loop.
   *
   * Deliberately does nothing. The sound no longer answers to the film — the
   * track just plays — but the call site is in the video's own loop and this
   * keeps it from having to know that.
   */
  update() {}

  /**
   * Silence, without tearing anything down: the track keeps its position and
   * comes back exactly where it would have been. Ramped rather than switched.
   */
  setMuted(muted) {
    this.muted = muted
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime
      const g = this.master.gain
      g.cancelScheduledValues(now)
      g.setValueAtTime(Math.max(g.value, 0.0001), now)
      g.exponentialRampToValueAtTime(muted ? 0.0001 : LEVEL, now + 0.4)
      return
    }
    if (this.el) this.el.volume = muted ? 0 : LEVEL
  }

  dispose() {
    if (this.el) {
      try {
        this.el.pause()
        this.el.removeAttribute('src')
        this.el.load()
      } catch {
        /* element already gone */
      }
      this.el = null
    }
    if (this.ctx) this.ctx.close().catch(() => {})
    this.ctx = null
    this.master = null
    this.ready = false
  }
}
