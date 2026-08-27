import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * One continuous gesture, four meanings.
 *
 *   hold    the hand rests on the glass — the steam clears
 *   scrub   the hand slides sideways — the film runs back or forward
 *   trace   the hand follows a gold path — the mark opens
 *   idle    the hand is gone — the steam rushes back
 *
 * All four come out of a single pointer stream, because the marks only appear
 * once the glass is clear, and the glass is only clear while the pointer is
 * down. Anything that needed a second press would be unreachable: you would
 * have to let go, and letting go closes everything.
 *
 * Mode is decided once per gesture and then locked, so a wobble halfway
 * through a rewind cannot turn it into a pull.
 */

/** Horizontal travel that turns a drag into a shuttle. */
const SCRUB_ENGAGE_PX = 34
/** Horizontal movement smaller than this does not count as movement. */
const SCRUB_REST_PX = 1
const TRACE_ENGAGE_PX = 10

export function useGestures({ enabled = true } = {}) {
  const [mode, setMode] = useState('idle')

  const gestureRef = useRef({
    mode: 'idle',
    holding: false,
    /** viewport uv, y up — what the shader wants */
    pointer: { x: 0.5, y: 0.5 },
    /** screen pixels, y down — what the interface wants */
    screen: { x: 0, y: 0 },
    origin: { x: 0, y: 0 },
    dx: 0,
    dy: 0,
    /** horizontal pixels the render loop has not spent on the film yet */
    scrubPending: 0,
    /** horizontal travel since the hand last changed its mind */
    hTravel: 0,
    lastHMoveAt: 0,
    /** set by the trace layer: the mark currently under the hand */
    armed: null,
    /** where the pull is measured from — see onMove */
    armAnchor: { x: 0, y: 0 },
    /** the trace layer raises this while a dwell is actually accumulating */
    dwelling: false,
    /** ±1 while an arrow key is held */
    keyDir: 0,
    movedAt: 0,
  })

  const setMod = useCallback((next) => {
    const g = gestureRef.current
    if (g.mode === next) return
    g.mode = next
    setMode(next)
  }, [])

  const release = useCallback(() => {
    const g = gestureRef.current
    if (!g.holding && g.mode === 'idle') return
    g.holding = false
    g.armed = null
    g.dx = 0
    g.dy = 0
    g.hTravel = 0
    g.scrubPending = 0
    setMod(g.keyDir ? 'scrub' : 'idle')
  }, [setMod])

  useEffect(() => {
    if (!enabled) {
      release()
      return undefined
    }

    const g = gestureRef.current

    const track = (e) => {
      g.screen = { x: e.clientX, y: e.clientY }
      g.pointer = {
        x: e.clientX / window.innerWidth,
        y: 1 - e.clientY / window.innerHeight,
      }
    }

    const onDown = (e) => {
      // Real controls keep their clicks.
      if (e.target instanceof Element && e.target.closest('[data-interactive]')) return
      track(e)
      g.holding = true
      g.origin = { x: e.clientX, y: e.clientY }
      g.dx = 0
      g.dy = 0
      g.hTravel = 0
      g.scrubPending = 0
      g.movedAt = performance.now()
      g.lastHMoveAt = performance.now()
      setMod('hold')
    }

    const onMove = (e) => {
      const now = performance.now()
      const prevX = g.screen.x
      const prevY = g.screen.y
      track(e)

      if (!g.holding) return

      const ddx = e.clientX - prevX
      const ddy = e.clientY - prevY

      g.dx = e.clientX - g.origin.x
      g.dy = e.clientY - g.origin.y

      const dtms = Math.max(now - g.movedAt, 1)
      g.movedAt = now
      if (dtms > 600) g.hTravel = 0 // the hand genuinely stopped
      if (Math.abs(ddx) >= SCRUB_REST_PX) g.lastHMoveAt = now

      if (g.mode === 'trace') return

      // A mark under the hand outranks the shuttle. Arriving at one ends any
      // sweep in progress, so the film is still by the time the pull starts —
      // and starting a pull mid-sweep is allowed, which is how it is actually
      // done.
      //
      // The anchor trails the hand until the pull genuinely starts, so the
      // journey *to* the mark is never counted as part of it. By the time a
      // mark exists the hand has been resting on the glass for a second or
      // two, somewhere else entirely; measuring from the press, or even from
      // the moment the mark lit up, would pull the ring backwards.
      const armed = g.armed
      if (armed) {
        const adx = e.clientX - g.armAnchor.x
        const ady = e.clientY - g.armAnchor.y
        const along = adx * armed.dir[0] + ady * armed.dir[1]
        const lateral = Math.abs(adx * -armed.dir[1] + ady * armed.dir[0])

        if (along > TRACE_ENGAGE_PX && along > lateral) {
          setMod('trace')
          return
        }
        // Forward motion accumulates — a pull is made of many small moves, and
        // re-anchoring on each one would mean it never starts. Only wandering
        // backwards or sideways resets it.
        if (along < 0 || lateral > 26) g.armAnchor = { x: e.clientX, y: e.clientY }

        g.hTravel = 0
        if (g.mode === 'scrub') setMod('hold')
        return
      }

      if (g.mode === 'scrub') {
        // The film follows the hand, frame by frame, like a jog wheel. Ending
        // the shuttle belongs to the render loop (see endScrub): a hand that
        // simply stops sends no further events, and a mode that can only be
        // left by moving would never be left at all.
        g.scrubPending += ddx
        return
      }

      // Engaging: sustained horizontal travel, with nothing else claiming the
      // hand. Deliberately not speed-gated — a velocity threshold behaves
      // differently on every frame rate, and a shuttle that only works on fast
      // hardware is worse than one that occasionally starts a little early.
      if (Math.abs(ddx) > Math.abs(ddy)) g.hTravel += ddx
      else g.hTravel = 0

      if (Math.abs(g.hTravel) > SCRUB_ENGAGE_PX) {
        g.scrubPending += g.hTravel
        g.hTravel = 0
        g.lastHMoveAt = now
        setMod('scrub')
      }
    }

    const onUp = () => release()
    const onHide = () => document.visibilityState === 'hidden' && release()

    const onKeyDown = (e) => {
      if (e.repeat) return
      if (e.target instanceof Element && e.target.closest('[data-interactive]')) return

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (g.holding) return
        g.holding = true
        g.origin = { ...g.screen }
        setMod('hold')
        return
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault()
        g.keyDir = e.code === 'ArrowLeft' ? -1 : 1
        setMod('scrub')
      }
    }

    const onKeyUp = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') release()
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        g.keyDir = 0
        setMod(g.holding ? 'hold' : 'idle')
      }
    }

    const onContextMenu = (e) => {
      if (g.holding) e.preventDefault()
    }

    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('visibilitychange', onHide)

    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [enabled, release, setMod])

  /**
   * Hand the gesture back after a mark resolves. A pull locks the hand so a
   * wobble cannot turn it into a rewind — but once the mark has opened (or the
   * pull has been abandoned) the hand has to be free again *without lifting*,
   * because lifting closes the glass and everything on it.
   */
  const releaseTrace = useCallback(() => {
    const g = gestureRef.current
    if (g.mode !== 'trace') return
    g.armAnchor = { ...g.screen }
    setMod(g.holding ? 'hold' : 'idle')
  }, [setMod])

  /**
   * End a shuttle. Called from the render loop, which is the only thing that
   * keeps ticking once the hand goes still.
   */
  const endScrub = useCallback(() => {
    const g = gestureRef.current
    if (g.mode !== 'scrub' || g.keyDir) return
    g.hTravel = 0
    setMod(g.holding ? 'hold' : 'idle')
  }, [setMod])

  return { mode, gestureRef, releaseTrace, endScrub }
}
