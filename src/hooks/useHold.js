import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Press and hold, from anywhere, by any input.
 *
 * Refs carry the per-frame truth (the render loop reads them without ever
 * re-rendering React); the boolean state exists only so the copy on screen can
 * react. Every way a hold can end — pointer up, pointer cancel, a dragged
 * finger leaving the glass, tab blur, window hidden — releases it, because a
 * hold that survives losing focus would leave explicit frames uncovered.
 */
export function useHold({ enabled = true } = {}) {
  const [holding, setHolding] = useState(false)
  const holdRef = useRef(false)
  const pointerRef = useRef({ x: 0.5, y: 0.5 })
  const startedAtRef = useRef(0)

  const press = useCallback((x, y) => {
    if (typeof x === 'number') pointerRef.current = { x, y }
    if (holdRef.current) return
    holdRef.current = true
    startedAtRef.current = performance.now()
    setHolding(true)
  }, [])

  const release = useCallback(() => {
    if (!holdRef.current) return
    holdRef.current = false
    setHolding(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      release()
      return undefined
    }

    const toUv = (e) => [
      e.clientX / window.innerWidth,
      1 - e.clientY / window.innerHeight,
    ]

    const onDown = (e) => {
      // Leave real controls alone — the CTA has to stay clickable.
      if (e.target instanceof Element && e.target.closest('[data-interactive]')) return
      press(...toUv(e))
    }
    const onMove = (e) => {
      const [x, y] = toUv(e)
      pointerRef.current = { x, y }
    }
    const onUp = () => release()
    const onHide = () => document.visibilityState === 'hidden' && release()

    const onKeyDown = (e) => {
      if (e.repeat) return
      if (e.code !== 'Space' && e.code !== 'Enter') return
      if (e.target instanceof Element && e.target.closest('[data-interactive]')) return
      e.preventDefault()
      press()
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') release()
    }
    const onContextMenu = (e) => {
      // Long-press on mobile otherwise pops a menu mid-reveal.
      if (holdRef.current) e.preventDefault()
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
  }, [enabled, press, release])

  return { holding, holdRef, pointerRef, startedAtRef, release }
}
