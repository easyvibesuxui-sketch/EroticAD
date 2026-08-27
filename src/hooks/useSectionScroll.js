import { useEffect, useRef, useState } from 'react'

/**
 * Which section the page is on.
 *
 * Read from scroll position rather than from IntersectionObserver: the stage is
 * fixed and the sections are empty spacers, so there is nothing meaningful to
 * observe, and scroll position answers the question exactly. The active index
 * changes only once the section is more than half-way in, which stops a section
 * from starting to play while it is still mostly off screen.
 */
export function useSectionScroll(count) {
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const progressRef = useRef(0)

  useEffect(() => {
    const measure = () => {
      const vh = window.innerHeight || 1
      const y = window.scrollY || window.pageYOffset || 0
      const exact = y / vh
      const next = Math.max(0, Math.min(count - 1, Math.round(exact)))

      progressRef.current = exact
      if (next !== activeRef.current) {
        activeRef.current = next
        setActive(next)
      }
    }

    // Measured in the handler rather than inside requestAnimationFrame:
    // browsers already fire scroll at most once a frame, and deferring to rAF
    // ties "which section am I on" to render throughput — on a machine
    // struggling with the shader, the section would arrive a second late.
    // `scrollY` is a cheap read that forces no layout.
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [count])

  return { active, activeRef, progressRef }
}
