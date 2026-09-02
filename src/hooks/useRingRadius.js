import { useEffect, useState } from 'react'

/**
 * How wide the ring's circle is, in screen pixels.
 *
 * The same reasoning as the straight mark's travel: a fixed radius that feels
 * deliberate on a desktop is most of a phone's width, and one that fits a phone
 * is a fidget on a desktop. It is a fraction of the viewport's shorter side,
 * bounded at both ends — too small and the turn has no resolution left, too
 * large and the arc runs off the screen.
 */

const MIN_RADIUS = 84
const EDGE_MARGIN = 40

export function useRingRadius(step) {
  const measure = () => {
    if (typeof window === 'undefined') return MIN_RADIUS
    const short = Math.min(window.innerWidth, window.innerHeight)
    const wanted = (step.radius ?? 0.15) * short
    return Math.max(MIN_RADIUS, Math.min(wanted, short / 2 - EDGE_MARGIN))
  }

  const [radius, setRadius] = useState(measure)

  useEffect(() => {
    const update = () => setRadius(measure())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  return radius
}
