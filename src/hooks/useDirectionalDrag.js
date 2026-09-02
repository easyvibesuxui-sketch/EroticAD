import { useCallback, useEffect, useRef, useState } from 'react'

import { COMMIT_THRESHOLD } from '../lib/sections.js'
import { DIRECTIONS } from '../lib/layout.js'

/**
 * Turn the last two seconds by hand.
 *
 * Pointer travel along the section's direction maps straight onto a 0..1
 * position in that range — drag forward and the action happens, drag back and
 * it un-happens, because it is the same two seconds of film read in either
 * direction. Nothing is animated: the hand is the transport.
 *
 * Letting go changes nothing. The film stays on the frame the hand left it on,
 * because that is what a mechanical control does — a spring that pulls the
 * garment shut the moment you release would mean the hand was never really
 * holding it. The piece counts as undone once the drag has carried it past the
 * threshold, and counts as done up again if it is dragged back below.
 */
export function useDirectionalDrag({
  dir = 'right',
  length = 96,
  enabled = true,
  onCommit,
  onUndo,
}) {
  const [dragging, setDragging] = useState(false)
  const [committed, setCommitted] = useState(false)

  const progressRef = useRef(0)
  const targetRef = useRef(0)
  const anchorRef = useRef({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const committedRef = useRef(false)
  const dirRef = useRef(DIRECTIONS[dir])
  const lengthRef = useRef(length)

  dirRef.current = DIRECTIONS[dir] ?? DIRECTIONS.right
  lengthRef.current = length

  const reset = useCallback(() => {
    progressRef.current = 0
    targetRef.current = 0
    draggingRef.current = false
    committedRef.current = false
    setDragging(false)
    setCommitted(false)
  }, [])

  /**
   * Crossing the threshold either way is what marks the piece undone. Both
   * crossings are announced: what the commit sets off, the crossing back has
   * to be able to take away.
   */
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

  const onPointerDown = useCallback(
    (e) => {
      if (!enabled) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      // The anchor is offset by whatever has already been wound on, so picking
      // the handle back up continues from where it sits instead of snapping.
      const [dx, dy] = dirRef.current
      const wound = progressRef.current * lengthRef.current
      anchorRef.current = { x: e.clientX - dx * wound, y: e.clientY - dy * wound }
      draggingRef.current = true
      setDragging(true)
    },
    [enabled],
  )

  const onPointerMove = useCallback((e) => {
    if (!draggingRef.current) return
    const [dx, dy] = dirRef.current
    const along = (e.clientX - anchorRef.current.x) * dx + (e.clientY - anchorRef.current.y) * dy
    const next = Math.max(0, Math.min(1, along / lengthRef.current))
    progressRef.current = next
    targetRef.current = next
    mark(next)
  }, [mark])

  const onPointerUp = useCallback((e) => {
    if (!draggingRef.current) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    // Nothing moves. The frame the hand let go on is the frame that stays.
    draggingRef.current = false
    targetRef.current = progressRef.current
    setDragging(false)
  }, [])

  // Keyboard equivalent: the action is the point, not the dexterity.
  const onKeyDown = useCallback(
    (e) => {
      if (!enabled) return
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      // No hand here, so this one does animate — but it is the only path that
      // moves the film on its own.
      targetRef.current = targetRef.current > 0.5 ? 0 : 1
      mark(targetRef.current)
    },
    [enabled, mark],
  )

  // Only the keyboard path has anything to ease toward; a released drag has
  // already arrived. This lives here rather than in the render loop so the
  // control behaves the same whether or not a frame is drawn.
  useEffect(() => {
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
  }, [])

  return {
    progressRef,
    dragging,
    committed,
    reset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  }
}
