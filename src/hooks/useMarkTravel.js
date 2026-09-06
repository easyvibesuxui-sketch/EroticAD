import { useCallback, useEffect, useState } from 'react'

import { DIRECTIONS, filmToScreen } from '../lib/layout.js'

/**
 * How far the mark travels, in screen pixels.
 *
 * Two things decide it, and neither is a constant.
 *
 * **How long the gesture should take.** A fixed 250px was covering a two and a
 * half second clip, which means an ordinary flick ran the whole action in under
 * half a second — over before the hand had felt it. The travel is a fraction of
 * the viewport's shorter side instead, so a deliberate drag takes about as long
 * as the film it is moving.
 *
 * **How much room there is.** The mark sits where the action is, which can be
 * close to an edge — section one starts at u 0.68 and pulls right, leaving only
 * a few hundred pixels before the window runs out. A drag cannot continue past
 * the edge of the screen, so the travel is clamped to what is actually
 * reachable from where the mark stands.
 */

/** Never shorter than this, or the control has no resolution left. */
const MIN_TRAVEL = 150

/** Clearance kept between the end of the travel and the edge of the window. */
const EDGE_MARGIN = 56

/**
 * The instruction hangs below the mark, so a downward pull needs more room at
 * the bottom than the mark itself takes.
 *
 * Measured: section six on a 1440x900 window ended its travel at y 844 — inside
 * the 56px margin, correctly — and then wrote "ease them down" at 909, thirty
 * pixels past the bottom of the window, where nobody ever read it. The margin
 * was reserving room for the wrong thing. Anything that hangs off the mark has
 * to be in the measurement, or the clamp is only pretending to keep it on
 * screen.
 */
const INSTRUCTION_ROOM = 96

export function useMarkTravel(step, aspectRef) {
  const measure = useCallback(() => {
    if (typeof window === 'undefined') return MIN_TRAVEL
    const vw = window.innerWidth
    const vh = window.innerHeight
    const [dx, dy] = DIRECTIONS[step.dir] ?? DIRECTIONS.right

    const wanted = (step.travel ?? 0.5) * Math.min(vw, vh)

    const p = filmToScreen(step.u, step.v, vw, vh, aspectRef.current || 16 / 9)
    const margin = EDGE_MARGIN + (dy > 0 ? INSTRUCTION_ROOM : 0)
    const room = (dx > 0 ? vw - p.x : dx < 0 ? p.x : dy > 0 ? vh - p.y : p.y) - margin

    return Math.max(MIN_TRAVEL, Math.min(wanted, room))
  }, [aspectRef, step])

  const [travel, setTravel] = useState(measure)

  useEffect(() => {
    const update = () => setTravel(measure())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [measure])

  return travel
}
