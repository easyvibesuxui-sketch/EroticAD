import { useCallback, useEffect, useRef, useState } from 'react'

import { COMMIT_THRESHOLD } from '../lib/sections.js'

/**
 * Turn the last two seconds by hand, around a centre.
 *
 * The same idea as the straight pull, in polar: the angle the pointer stands
 * at, measured from the ring's centre, maps onto a 0..1 position in the clip.
 * Turn one way and the action happens, turn back and it un-happens. Nothing is
 * animated — the hand is the transport, frame for frame.
 *
 * Angles are unwrapped as they are read, so a hand that crosses due-west does
 * not jump half a turn; and only the *change* in angle is used, so the grab can
 * start anywhere rather than only on the ring itself.
 *
 * The wound value is allowed a little way below zero. That slack is the only
 * way back out of a step: a section built from two clips uses it to hand the
 * film back to the previous one, which is what keeps a chain of actions as
 * reversible as a single one.
 */

/** How far below zero the hand may carry before the step gives way. */
const UNDERSHOOT = 0.12

/** Past this on the way back, the previous step takes the film again. */
const EXIT_BACK = -0.06

/** Fully wound. Past this the next step takes over. */
const FULL = 0.995

/** Nearer the centre than this, the angle is noise rather than a gesture. */
const DEAD_RADIUS = 26

const TAU = Math.PI * 2

export function useAngularDrag({
  step,
  centreRef,
  radius = 160,
  enabled = true,
  progressRef: externalProgress,
  onCommit,
  onUndo,
  onFull,
  onExitBack,
}) {
  const [dragging, setDragging] = useState(false)
  const [committed, setCommitted] = useState(false)

  const ownProgress = useRef(0)
  const progressRef = externalProgress ?? ownProgress
  const targetRef = useRef(0)
  const draggingRef = useRef(false)
  const committedRef = useRef(false)
  const lastAngleRef = useRef(0)
  const woundRef = useRef(0)

  const sweep = ((step?.sweep ?? 240) * Math.PI) / 180
  const spin = step?.spin ?? 1
  const sweepRef = useRef(sweep)
  const spinRef = useRef(spin)
  sweepRef.current = sweep
  spinRef.current = spin

  const reset = useCallback(
    (to = 0) => {
      progressRef.current = to
      targetRef.current = to
      woundRef.current = to
      draggingRef.current = false
      committedRef.current = to >= COMMIT_THRESHOLD
      setDragging(false)
      setCommitted(to >= COMMIT_THRESHOLD)
    },
    [progressRef],
  )

  /** Crossing the threshold either way is what marks the piece undone. */
  const mark = useCallback(
    (value) => {
      const past = value >= COMMIT_THRESHOLD
      if (past === committedRef.current) return
      committedRef.current = past
      setCommitted(past)
      if (past) onCommit?.()
      else onUndo?.()
    },
    [onCommit, onUndo],
  )

  const angleAt = useCallback(
    (e) => {
      const c = centreRef.current
      if (!c) return null
      const dx = e.clientX - c.x
      const dy = e.clientY - c.y
      if (Math.hypot(dx, dy) < DEAD_RADIUS) return null
      return Math.atan2(dy, dx)
    },
    [centreRef],
  )

  const onPointerDown = useCallback(
    (e) => {
      if (!enabled) return
      const a = angleAt(e)
      if (a === null) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      lastAngleRef.current = a
      woundRef.current = progressRef.current
      draggingRef.current = true
      setDragging(true)
    },
    [angleAt, enabled, progressRef],
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!draggingRef.current) return
      const a = angleAt(e)
      if (a === null) return

      // Unwrap: the shortest way round from the last reading is the way the
      // hand actually went. Without this, crossing due-west reads as a jump of
      // a full turn in the wrong direction.
      let delta = a - lastAngleRef.current
      if (delta > Math.PI) delta -= TAU
      else if (delta < -Math.PI) delta += TAU
      lastAngleRef.current = a

      const next = Math.max(
        -UNDERSHOOT,
        Math.min(1, woundRef.current + (delta * spinRef.current) / sweepRef.current),
      )
      woundRef.current = next

      const shown = Math.max(0, next)
      progressRef.current = shown
      targetRef.current = shown
      mark(shown)

      if (next >= FULL) onFull?.()
      else if (next <= EXIT_BACK) onExitBack?.()
    },
    [angleAt, mark, onExitBack, onFull, progressRef],
  )

  const onPointerUp = useCallback((e) => {
    if (!draggingRef.current) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    // Nothing moves. The frame the hand let go on is the frame that stays.
    draggingRef.current = false
    woundRef.current = Math.max(0, woundRef.current)
    targetRef.current = progressRef.current
    setDragging(false)
  }, [progressRef])

  // Keyboard equivalent: the action is the point, not the dexterity.
  const onKeyDown = useCallback(
    (e) => {
      if (!enabled) return
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      const to = targetRef.current > 0.5 ? 0 : 1
      targetRef.current = to
      woundRef.current = to
      mark(to)
      if (to === 1) onFull?.()
    },
    [enabled, mark, onFull],
  )

  // Only the keyboard path has anything to ease toward; a released turn has
  // already arrived.
  useEffect(() => {
    if (!enabled) return undefined
    let raf = 0
    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 1 / 8)
      last = now
      if (!draggingRef.current) {
        const to = targetRef.current
        const from = progressRef.current
        if (Math.abs(to - from) > 0.0005) {
          progressRef.current = from + (to - from) * (1 - Math.exp(-dt / 0.13))
        } else {
          progressRef.current = to
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled, progressRef])

  return {
    progressRef,
    dragging,
    committed,
    reset,
    radius,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  }
}
