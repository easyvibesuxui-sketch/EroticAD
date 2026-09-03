import { useCallback, useEffect, useRef, useState } from 'react'

import { COMMIT_THRESHOLD } from '../lib/sections.js'
import { nearestOnPath } from '../lib/layout.js'

/**
 * Turn the last seconds by hand, along a route that is not a straight line.
 *
 * The straight mark projects the hand onto a direction; the ring measures the
 * angle it stands at. This one asks where on the route the hand is: the
 * nearest point on the polyline, as a distance along it, is the position in
 * the clip. Follow the route forward and the action happens, come back along
 * it and it un-happens, exactly as before.
 *
 * What makes it a route rather than a decoration is the corridor. A hand that
 * strays further than `corridor` from the line moves nothing at all — so
 * cutting the corners of a zigzag does not work, and the shape drawn on the
 * film is the shape the hand has to make.
 */

/** How far off the route the hand may be and still be on it. */
const CORRIDOR_PAD = 46

/** Fully wound. */
const FULL = 0.995

/**
 * The most of the clip one pointer event may move. A guard against a pointer
 * that teleports — a touch that lifts and lands elsewhere, a dropped frame —
 * which would otherwise jump the film across the gap.
 */
const MAX_STEP = 0.15

export function usePathDrag({
  path,
  originRef,
  enabled = true,
  progressRef: externalProgress,
  onCommit,
  onUndo,
  onFull,
}) {
  const [dragging, setDragging] = useState(false)
  const [committed, setCommitted] = useState(false)

  const ownProgress = useRef(0)
  const progressRef = externalProgress ?? ownProgress
  const targetRef = useRef(0)
  const draggingRef = useRef(false)
  const committedRef = useRef(false)
  const pathRef = useRef(path)
  pathRef.current = path

  const reset = useCallback(() => {
    progressRef.current = 0
    targetRef.current = 0
    draggingRef.current = false
    committedRef.current = false
    setDragging(false)
    setCommitted(false)
  }, [progressRef])

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

  /** Where the hand is on the route, in local coordinates. */
  const readAt = useCallback(
    (e) => {
      const o = originRef.current
      const p = pathRef.current
      if (!o || !p || p.length < 2) return null
      return nearestOnPath(p.points, p.cum, e.clientX - o.x, e.clientY - o.y)
    },
    [originRef],
  )

  const onPointerDown = useCallback(
    (e) => {
      if (!enabled) return
      const hit = readAt(e)
      if (!hit) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      draggingRef.current = true
      setDragging(true)
    },
    [enabled, readAt],
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!draggingRef.current) return
      const hit = readAt(e)
      if (!hit) return
      const p = pathRef.current
      // Off the route: nothing moves. This is what makes the corners real.
      if (hit.off > p.amplitude + CORRIDOR_PAD) return

      const want = hit.s / p.length
      const from = progressRef.current
      const stepped = Math.max(-MAX_STEP, Math.min(MAX_STEP, want - from))
      const next = Math.max(0, Math.min(1, from + stepped))

      progressRef.current = next
      targetRef.current = next
      mark(next)
      if (next >= FULL) onFull?.()
    },
    [mark, onFull, progressRef, readAt],
  )

  const onPointerUp = useCallback(
    (e) => {
      if (!draggingRef.current) return
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      // Nothing moves. The frame the hand let go on is the frame that stays.
      draggingRef.current = false
      targetRef.current = progressRef.current
      setDragging(false)
    },
    [progressRef],
  )

  // Keyboard equivalent: the action is the point, not the dexterity.
  const onKeyDown = useCallback(
    (e) => {
      if (!enabled) return
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      targetRef.current = targetRef.current > 0.5 ? 0 : 1
      mark(targetRef.current)
      if (targetRef.current === 1) onFull?.()
    },
    [enabled, mark, onFull],
  )

  // Only the keyboard path has anything to ease toward; a released hand has
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
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  }
}
