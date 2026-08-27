import { FILM_SECONDS } from './sections.js'

/**
 * The playhead, whether or not there is a film.
 *
 * Everything above this talks in seconds — play from here, hold at 48.0, put
 * frame 49.32 on screen. Underneath it is either a real <video> or a virtual
 * clock driving the procedural stand-in, and nothing else in the app can tell
 * the difference. That is what makes the whole scroll architecture testable
 * before a single frame has been shot.
 */
export class Playhead {
  constructor(videoEl = null, duration = FILM_SECONDS) {
    this.video = videoEl
    this.virtualTime = 0
    this.virtualPlaying = false
    this.lastTick = 0
    this.fallbackDuration = duration
  }

  get isVirtual() {
    return !this.video
  }

  get duration() {
    const d = this.video?.duration
    return Number.isFinite(d) && d > 0 ? d : this.fallbackDuration
  }

  get time() {
    return this.video ? this.video.currentTime : this.virtualTime
  }

  get playing() {
    return this.video ? !this.video.paused : this.virtualPlaying
  }

  play() {
    if (this.video) {
      this.video.play().catch(() => {})
      return
    }
    this.lastTick = performance.now()
    this.virtualPlaying = true
  }

  pause() {
    if (this.video) this.video.pause()
    else this.virtualPlaying = false
  }

  /**
   * Put a specific frame on screen. Sub-frame moves are dropped: at 25fps
   * anything under ~20ms cannot change the picture, and a seek storm costs far
   * more than it shows.
   */
  seek(seconds, epsilon = 0.02) {
    const t = Math.max(0, Math.min(seconds, this.duration - 0.05))
    if (Math.abs(this.time - t) < epsilon) return
    if (this.video) this.video.currentTime = t
    else {
      this.virtualTime = t
      this.lastTick = performance.now()
    }
  }

  /**
   * Advance the virtual clock. A real element advances itself.
   *
   * Deliberately on wall-clock rather than on the render delta: a film does not
   * play in slow motion because the GPU is busy, and the stand-in must not
   * either, or every timing in the piece drifts on slow hardware.
   */
  tick() {
    if (this.video) return
    const now = performance.now()
    if (!this.virtualPlaying) {
      this.lastTick = now
      return
    }
    // Barely capped: a real <video> keeps playing through a stall, and a cap
    // tight enough to "smooth" the clock silently runs the film in slow motion
    // on slow hardware. A jump past the hold point is self-correcting — the
    // section pauses and seeks back to it.
    const dt = Math.min((now - this.lastTick) / 1000, 1.5)
    this.lastTick = now
    this.virtualTime = Math.min(this.virtualTime + dt, this.duration)
  }
}
