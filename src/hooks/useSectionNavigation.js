import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Section-at-a-time scrolling, driven rather than suggested.
 *
 * CSS scroll snapping was the obvious answer and it does not work here.
 * Measured, with `y mandatory` and `scroll-snap-align: start` on every section:
 * one wheel gesture came to rest at 420px — between two sections — the next did
 * nothing at all, the one after jumped 840px, and a flick landed at 3700px,
 * aligned to nothing. `scroll-behavior: smooth` and mandatory snapping fight
 * each other, and nothing stops a flick crossing several snap points anyway.
 *
 * So the wheel, the swipe and the keys are read directly and each one moves
 * exactly one section. The document still scrolls — the scrollbar, Home/End and
 * assistive technology all keep working — but the resting position is always a
 * section boundary, because nothing else is ever asked for.
 *
 * The move itself is instant, which sounds wrong and is not. The stage is
 * fixed: during a section change the film does not travel, only the copy and
 * the rail change, and both already cross-fade on their own over ~900ms. An
 * animated scroll would therefore animate nothing except the scrollbar — while
 * being the one part of this that depends on a free main thread. Measured with
 * the shader running, a smooth 844px scroll had not finished 2.6 seconds later,
 * and the film sat a whole section ahead of the page. Cutting is both truer to
 * the medium and the only version that cannot fall behind.
 */

/** Wheel delta that counts as a gesture rather than a twitch. */
const WHEEL_THRESHOLD = 24

/**
 * After a move, keep swallowing wheel input until it has been quiet this long.
 * Trackpad momentum arrives as a long tail of events after the fingers have
 * lifted; a fixed timeout either cuts it off too early — and the tail moves a
 * second section — or is so long it makes the page feel unresponsive. Waiting
 * for quiet is the only version that scales to how hard someone flicked.
 */
const MOMENTUM_QUIET_MS = 150

/** Swipe distance, in pixels, that counts as a gesture. */
const SWIPE_THRESHOLD = 55

/** Minimum settle time after a move, before any new gesture is read. */
const LOCK_MS = 260

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function useSectionNavigation({ count, enabled = true, trackRef }) {
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const lockUntilRef = useRef(0)
  const wheelRef = useRef(0)
  const touchRef = useRef({ y: 0, claimed: false })

  const sectionHeight = useCallback(() => {
    const first = trackRef?.current?.firstElementChild
    return first?.offsetHeight || window.innerHeight || 1
  }, [trackRef])

  const goTo = useCallback(
    (next, { instant = false } = {}) => {
      const target = clamp(next, 0, count - 1)
      indexRef.current = target
      setIndex(target)
      lockUntilRef.current = performance.now() + (instant ? 0 : LOCK_MS)
      window.scrollTo({ top: target * sectionHeight(), behavior: 'auto' })
    },
    [count, sectionHeight],
  )

  const step = useCallback((delta) => goTo(indexRef.current + delta), [goTo])

  useEffect(() => {
    if (!enabled) return undefined

    const locked = () => performance.now() < lockUntilRef.current

    const onWheel = (e) => {
      // Taking the wheel is the point: left to itself the browser lands
      // wherever momentum stops, which is the bug this exists to fix.
      e.preventDefault()
      if (locked()) {
        // Still inside the gesture: this is momentum, not a new intent.
        wheelRef.current = 0
        lockUntilRef.current = performance.now() + MOMENTUM_QUIET_MS
        return
      }
      wheelRef.current += e.deltaY
      if (Math.abs(wheelRef.current) < WHEEL_THRESHOLD) return
      const dir = wheelRef.current > 0 ? 1 : -1
      wheelRef.current = 0
      step(dir)
    }

    const onTouchStart = (e) => {
      // A mark that has claimed the touch owns the whole gesture.
      const onMark = e.target instanceof Element && e.target.closest('[data-claims-touch="true"]')
      touchRef.current = { y: e.touches[0]?.clientY ?? 0, claimed: Boolean(onMark) }
    }

    const onTouchMove = (e) => {
      if (touchRef.current.claimed) return
      e.preventDefault()
    }

    const onTouchEnd = (e) => {
      if (touchRef.current.claimed || locked()) return
      const endY = e.changedTouches[0]?.clientY ?? touchRef.current.y
      const delta = touchRef.current.y - endY
      if (Math.abs(delta) < SWIPE_THRESHOLD) return
      step(delta > 0 ? 1 : -1)
    }

    const onKeyDown = (e) => {
      if (e.target instanceof Element && e.target.closest('[data-interactive]')) return
      const down = ['ArrowDown', 'PageDown'].includes(e.key)
      const up = ['ArrowUp', 'PageUp'].includes(e.key)
      if (!down && !up && e.key !== 'Home' && e.key !== 'End') return
      e.preventDefault()
      if (locked()) return
      if (e.key === 'Home') goTo(0)
      else if (e.key === 'End') goTo(count - 1)
      else step(down ? 1 : -1)
    }

    // The scrollbar, a browser restoring position, an anchor — anything that
    // moves the page without going through goTo still has to update the index.
    const onScroll = () => {
      if (locked()) return
      const next = clamp(Math.round(window.scrollY / sectionHeight()), 0, count - 1)
      if (next === indexRef.current) return
      indexRef.current = next
      setIndex(next)
    }

    const onResize = () => goTo(indexRef.current, { instant: true })

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [count, enabled, goTo, sectionHeight, step])

  return { index, indexRef, goTo, step }
}
