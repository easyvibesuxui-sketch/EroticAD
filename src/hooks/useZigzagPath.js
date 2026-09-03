import { useEffect, useMemo, useState } from 'react'

import { pathMetrics, zigzagPoints } from '../lib/layout.js'

/**
 * The zigzag's shape in screen pixels, local to the mark's origin.
 *
 * Both halves of the control need the same list — the guide draws it and the
 * hand is measured against it — so it is built once here and handed to both.
 * Sized off the viewport's shorter side for the same reason the straight
 * mark's travel is: a route that feels deliberate on a desktop is most of a
 * phone's width.
 */
export function useZigzagPath(step) {
  const [short, setShort] = useState(() =>
    typeof window === 'undefined' ? 800 : Math.min(window.innerWidth, window.innerHeight),
  )

  useEffect(() => {
    const update = () => setShort(Math.min(window.innerWidth, window.innerHeight))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return useMemo(() => {
    const span = Math.max(180, (step.span ?? 0.4) * short)
    const amplitude = Math.max(24, (step.amplitude ?? 0.05) * short)
    const points = zigzagPoints({ dir: step.dir, span, amplitude, teeth: step.teeth ?? 4 })
    const { cum, length } = pathMetrics(points)
    return { points, cum, length, span, amplitude }
  }, [short, step])
}
