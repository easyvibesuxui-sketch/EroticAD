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
 * Let go and it commits or winds back, depending on how far it got. Halfway is
 * not a state a garment can be left in.
 */
export function useDirectionalDrag({ dir = 'right', length = 96, enabled = true, onCommit }) {
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

  const settle = useCallback(() => {
    const past = progressRef.current >= COMMIT_THRESHOLD
    targetRef.current = past ? 1 : 0
    draggingRef.current = false
    setDragging(false)
    if (past && !committedRef.current) {
      committedRef.current = true
      setCommitted(true)
      onCommit?.()
    }
    if (!past && committedRef.current) {
      committedRef.current = false
      setCommitted(false)
    }
  }, [onCommit])

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
  }, [])

  const onPointerUp = useCallback(
    (e) => {
      if (!draggingRef.current) return
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      settle()
    },
    [settle],
  )

  // Keyboard equivalent: the action is the point, not the dexterity.
  const onKeyDown = useCallback(
    (e) => {
      if (!enabled) return
      if (e.code !== 'Space' && e.code !== 'Enter') return
      e.preventDefault()
      targetRef.current = targetRef.current > 0.5 ? 0 : 1
      if (targetRef.current === 1 && !committedRef.current) {
        committedRef.current = true
        setCommitted(true)
        onCommit?.()
      } else if (targetRef.current === 0 && committedRef.current) {
        committedRef.current = false
        setCommitted(false)
      }
    },
    [enabled, onCommit],
  )

  // Easing toward the settled position lives here rather than in the render
  // loop, so the control behaves the same whether or not a frame is drawn.
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
