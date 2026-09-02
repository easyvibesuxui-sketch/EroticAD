import { bpmFor } from './pulse.js'

/*
 *  THE ROOM
 *  --------
 *  Covered:  everything is behind the glass with the video. One low-pass, wide
 *            open resonance, almost no top end — the track arrives as pressure
 *            in the chest and a pulse in the ears.
 *  Revealed: the filter opens all the way and the heartbeat backs off.
 *  After:    the piece is off. The second audio is held back until then and
 *            plays once, in the clear, outside the glass.
 *
 *  If no track loads, the bed is synthesised in-graph so the mechanic is never
 *  silent. Either way the tempo is driven by the same heart the shader is.
 */

/*
 * The veil on the sound.
 *
 * Deliberately not a hard low-pass. With ten actions per visit the filter is
 * closed far more often than it is open, and a 180 Hz resting cutoff — right
 * for a single held reveal — leaves a real track sounding broken for most of
 * the page. 2.2 kHz reads as *veiled*: the music is plainly there, it just has
 * not been let all the way into the room yet.
 */
const VEILED_HZ = 2200
const OPEN_HZ = 18000
const VEILED_Q = 1.25
const OPEN_Q = 0.7

/** How much of your own pulse you hear while an action is still waiting. */
const HEART_RESTING = 0.34
const HEART_OPEN = 0.08

const lerp = (a, b, t) => a + (b - a) * t

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.ready = false
    this.usingSynthBed = true
    this.usingSynthAfter = true

    this.muted = false
    this.afterEl = null
    this.afterStopTimer = 0
    this.beat = 0
    this.lastBeatIndex = -1
    this.elements = []
    this.voices = []
  }

  /**
   * Open the context. This has to run *synchronously* inside the user gesture
   * — awaiting the media loads first would spend the activation and leave the
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

  /** Build the graph once the media elements have resolved. */
  async start({ musicEl = null, afterEl = null } = {}) {
    if (this.ready) return
    const ctx = this.prime()
    if (!ctx) return
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})

    // --- master ---------------------------------------------------------
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 12
    limiter.ratio.value = 12
    limiter.attack.value = 0.004
    limiter.release.value = 0.25

    const master = ctx.createGain()
    master.gain.value = 0.0001
    master.connect(limiter).connect(ctx.destination)
    this.master = master

    // --- the glass: one filter the whole bed lives behind ---------------
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = VEILED_HZ
    tone.Q.value = VEILED_Q
    tone.connect(master)
    this.tone = tone

    const bedGain = ctx.createGain()
    bedGain.gain.value = 0.9
    bedGain.connect(tone)
    this.bedGain = bedGain

    // --- track ----------------------------------------------------------
    if (musicEl) {
      try {
        const node = ctx.createMediaElementSource(musicEl)
        node.connect(bedGain)
        musicEl.volume = 1
        await musicEl.play().catch(() => {})
        this.elements.push(musicEl)
        this.usingSynthBed = false
      } catch {
        // Almost always a CORS refusal on the media element. Fall through to
        // the synth bed rather than dropping the audio design entirely.
        this.usingSynthBed = true
      }
    }
    if (this.usingSynthBed) this.#buildSynthBed()

    /*
     * The second audio.
     *
     * It is not a bed and it is not gated by how far the hand has got: it is
     * what the section is for, and it waits for the action to be carried
     * through. `after()` fires it; dragging the piece back stops it, because
     * on this site everything the hand does is reversible.
     *
     * Wired outside the low-pass, so when it comes it is unmistakably in the
     * room rather than behind the glass with the track.
     */
    const afterGain = ctx.createGain()
    afterGain.gain.value = 0.0001
    afterGain.connect(master)
    this.afterGain = afterGain

    if (afterEl) {
      try {
        const node = ctx.createMediaElementSource(afterEl)
        const air = ctx.createBiquadFilter()
        air.type = 'highpass'
        air.frequency.value = 320
        node.connect(air).connect(afterGain)
        // Loaded and silent. Nothing plays until the action asks for it.
        afterEl.loop = false
        afterEl.pause()
        this.afterEl = afterEl
        this.elements.push(afterEl)
        this.usingSynthAfter = false
      } catch {
        this.usingSynthAfter = true
      }
    }
    if (this.usingSynthAfter) this.#buildSynthAfter()

    this.#buildHeart()
    this.#buildShuttle()

    // Fade the room in rather than slamming the door open — unless the sound
    // was switched off while it was still loading.
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    if (!this.muted) master.gain.exponentialRampToValueAtTime(0.85, ctx.currentTime + 2.6)

    this.ready = true
  }

  // ------------------------------------------------------------------ synth

  #noiseBuffer(seconds = 2) {
    const { ctx } = this
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      // Slightly brown noise: warmer, less hissy, sits better under a body.
      last = (last + Math.random() * 2 - 1) * 0.5
      data[i] = last
    }
    return buf
  }

  /** A slow A-minor bed: sub, pad, and a soft tick on the offbeat. */
  #buildSynthBed() {
    const { ctx, bedGain } = this

    const sub = ctx.createGain()
    sub.gain.value = 0.0001
    sub.connect(bedGain)
    const subOsc = ctx.createOscillator()
    subOsc.type = 'sine'
    subOsc.frequency.value = 55
    subOsc.connect(sub)
    subOsc.start()
    this.subGain = sub
    this.voices.push(subOsc)

    const padFilter = ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 620
    padFilter.Q.value = 0.6
    const padGain = ctx.createGain()
    padGain.gain.value = 0.055
    padFilter.connect(padGain).connect(bedGain)

    // Am9 — the most sensual four notes available for free.
    for (const [freq, detune] of [
      [110, -6],
      [130.81, 4],
      [164.81, -3],
      [246.94, 7],
    ]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      const g = ctx.createGain()
      g.gain.value = 0.25
      osc.connect(g).connect(padFilter)
      osc.start()
      this.voices.push(osc)

      // Slow drift so the chord never sits perfectly still.
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.05 + Math.random() * 0.08
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 5
      lfo.connect(lfoGain).connect(osc.detune)
      lfo.start()
      this.voices.push(lfo)
    }
    this.padFilter = padFilter

    this.noise = this.#noiseBuffer()
  }

  /**
   * What plays after the action when no file has been dropped in: air moving
   * over a mic, one breath taken and let go. Silent until `after()` shapes it,
   * so the site is never mute at the moment that matters and never hums
   * underneath the ones that do not.
   */
  #buildSynthAfter() {
    const { ctx, afterGain } = this
    if (!this.noise) this.noise = this.#noiseBuffer()

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 900
    band.Q.value = 0.9

    const shape = ctx.createGain()
    shape.gain.value = 0.0001

    src.connect(band).connect(shape).connect(afterGain)
    src.start()

    this.afterSrc = src
    this.afterBand = band
    this.afterShape = shape
    this.voices.push(src)
  }

  /**
   * Tape. Rewinding and running forward are audible: filtered noise whose
   * pitch and brightness follow the shuttle speed, over a ducked bed.
   */
  #buildShuttle() {
    const { ctx, master } = this
    if (!this.noise) this.noise = this.#noiseBuffer()

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 700
    band.Q.value = 1.3

    const gain = ctx.createGain()
    gain.gain.value = 0.0001

    src.connect(band).connect(gain).connect(master)
    src.start()

    this.shuttleSrc = src
    this.shuttleBand = band
    this.shuttleGain = gain
    this.voices.push(src)
  }

  /**
   * A mark opening. Deliberately outside the low-pass — this one is allowed
   * to cut through whatever the glass is doing.
   */
  chime(strength = 1) {
    if (!this.ready || !this.ctx) return
    const { ctx, master } = this
    const now = ctx.currentTime

    for (const [freq, level, delay] of [
      [1046.5, 0.05, 0],
      [1567.98, 0.028, 0.012],
      [2093, 0.014, 0.03],
    ]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)

      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, now + delay)
      env.gain.exponentialRampToValueAtTime(level * strength, now + delay + 0.008)
      env.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.4)

      osc.connect(env).connect(master)
      osc.start(now + delay)
      osc.stop(now + delay + 1.5)
    }
  }

  /**
   * The second audio, at the end of a section — the piece is off, so play it.
   *
   * Called on the commit, not during the drag: the whole point is that it is
   * deferred until the action has actually been carried through. Retriggering
   * is deliberate — undo the action and do it again and you hear it again,
   * from the top, because on this site nothing that happened is permanent.
   */
  after(strength = 1) {
    if (!this.ready || !this.ctx) return
    const { ctx, afterGain } = this
    const now = ctx.currentTime

    const g = afterGain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(Math.max(g.value, 0.0001), now)
    g.exponentialRampToValueAtTime(Math.max(0.9 * strength, 0.001), now + 0.18)

    if (this.afterEl) {
      try {
        this.afterEl.currentTime = 0
      } catch {
        /* not seekable yet; it will start wherever it can */
      }
      this.afterEl.play().catch(() => {})
      return
    }

    // No file: breathe one. In, held, out — about four seconds all told.
    if (!this.afterShape) return
    const env = this.afterShape.gain
    env.cancelScheduledValues(now)
    env.setValueAtTime(Math.max(env.value, 0.0001), now)
    env.exponentialRampToValueAtTime(0.26 * strength, now + 0.7)
    env.exponentialRampToValueAtTime(0.14 * strength, now + 1.5)
    env.exponentialRampToValueAtTime(0.0001, now + 4.0)

    const f = this.afterBand.frequency
    f.cancelScheduledValues(now)
    f.setValueAtTime(700, now)
    f.linearRampToValueAtTime(1250, now + 0.7)
    f.linearRampToValueAtTime(620, now + 4.0)
  }

  /**
   * Take it back. Dragging the piece back on un-does the action, and a sound
   * still playing over a robe that has closed again would be the one thing on
   * the page that refuses to be undone.
   */
  stopAfter() {
    if (!this.ready || !this.ctx) return
    const { ctx, afterGain } = this
    const now = ctx.currentTime

    const g = afterGain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(Math.max(g.value, 0.0001), now)
    g.exponentialRampToValueAtTime(0.0001, now + 0.3)

    if (this.afterShape) {
      const env = this.afterShape.gain
      env.cancelScheduledValues(now)
      env.setValueAtTime(Math.max(env.value, 0.0001), now)
      env.exponentialRampToValueAtTime(0.0001, now + 0.3)
    }

    // Let the fade finish before the element stops, or the cut is audible.
    if (this.afterEl) {
      const el = this.afterEl
      clearTimeout(this.afterStopTimer)
      this.afterStopTimer = setTimeout(() => el.pause(), 340)
    }
  }

  /** The pulse you hear when your ears are covered. */
  #buildHeart() {
    const { ctx, master } = this

    const bus = ctx.createGain()
    bus.gain.value = 0.0001
    bus.connect(master)

    const body = ctx.createBiquadFilter()
    body.type = 'lowpass'
    body.frequency.value = 140
    body.Q.value = 1.1
    body.connect(bus)

    this.heartBus = bus
    this.heartBody = body
  }

  #thump(when, strength) {
    const { ctx, heartBody } = this
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(78, when)
    osc.frequency.exponentialRampToValueAtTime(34, when + 0.13)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, when)
    env.gain.exponentialRampToValueAtTime(Math.max(strength, 0.001), when + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.20)

    osc.connect(env).connect(heartBody)
    osc.start(when)
    osc.stop(when + 0.26)
  }

  #note(when, freq, strength) {
    const { ctx, bedGain } = this
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, when)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, when)
    env.gain.exponentialRampToValueAtTime(strength, when + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.55)

    osc.connect(env).connect(bedGain)
    osc.start(when)
    osc.stop(when + 0.6)
  }

  // ----------------------------------------------------------------- update

  /**
   * Called once a frame from the render loop.
   * @param {number} reveal  eased reveal, 0 fogged .. 1 clear
   * @param {number} dt      seconds since the last frame
   * @param {number} breathV slow respiration, 0..1
   * @param {number} shuttle  -1..1 rewind/forward speed
   */
  update(reveal, dt, breathV, shuttle = 0) {
    if (!this.ready || !this.ctx) return
    const { ctx } = this
    const now = ctx.currentTime

    // The glass opens. Exponential, because hearing is.
    this.tone.frequency.value = VEILED_HZ * Math.pow(OPEN_HZ / VEILED_HZ, reveal)
    this.tone.Q.value = lerp(VEILED_Q, OPEN_Q, reveal)
    if (this.padFilter) this.padFilter.frequency.value = lerp(620, 2400, reveal)

    // Heartbeat recedes as the action completes — you stop listening to
    // yourself. It sits under a real track, not over it.
    this.heartBus.gain.value = lerp(HEART_RESTING, HEART_OPEN, reveal)

    /*
     * The second audio is not touched here. It belongs to the end of the
     * section, not to the drag — `after()` starts it and `stopAfter()` takes
     * it away, both of them scheduled on the graph's own clock. `breathV`
     * still drives the picture; it no longer drives the sound.
     */

    // Tape over a ducked bed.
    const mag = Math.min(1, Math.abs(shuttle))
    if (this.shuttleGain) {
      this.shuttleGain.gain.value = lerp(this.shuttleGain.gain.value, mag * 0.11, Math.min(1, dt * 9))
      this.shuttleBand.frequency.value = lerp(520, 2700, mag)
      this.shuttleSrc.playbackRate.value = 0.6 + mag * 1.7
    }
    this.bedGain.gain.value = lerp(this.bedGain.gain.value, 0.9 - mag * 0.45, Math.min(1, dt * 6))

    // One clock: the bed follows the pulse.
    const bpm = bpmFor(reveal)
    this.beat += (dt * bpm) / 60
    const index = Math.floor(this.beat)
    if (index !== this.lastBeatIndex) {
      this.lastBeatIndex = index
      const spb = 60 / bpm

      this.#thump(now, lerp(0.42, 0.16, reveal))
      this.#thump(now + spb * 0.2, lerp(0.24, 0.09, reveal))

      if (this.usingSynthBed) {
        const bass = [55, 55, 65.41, 49][index % 4]
        this.#note(now, bass, 0.16)
        if (index % 2 === 1) this.#note(now + spb * 0.5, bass * 4, 0.03 + reveal * 0.04)
        if (this.subGain) {
          this.subGain.gain.setTargetAtTime(0.12 + reveal * 0.05, now, 0.08)
          this.subGain.gain.setTargetAtTime(0.02, now + spb * 0.35, 0.12)
        }
      }
    }
  }

  /**
   * Silence, without tearing the graph down — the film keeps its timing and
   * the room comes back exactly as it was. Ramped rather than switched: a gain
   * cut to zero in one sample is an audible click.
   */
  setMuted(muted) {
    this.muted = muted
    if (!this.ready || !this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const g = this.master.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(Math.max(g.value, 0.0001), now)
    g.exponentialRampToValueAtTime(muted ? 0.0001 : 0.85, now + 0.4)
  }

  dispose() {
    clearTimeout(this.afterStopTimer)
    for (const el of this.elements) {
      try {
        el.pause()
        el.removeAttribute('src')
        el.load()
      } catch {
        /* element already gone */
      }
    }
    for (const v of this.voices) {
      try {
        v.stop()
      } catch {
        /* already stopped */
      }
    }
    this.elements = []
    this.voices = []
    if (this.ctx) this.ctx.close().catch(() => {})
    this.ctx = null
    this.ready = false
  }
}
