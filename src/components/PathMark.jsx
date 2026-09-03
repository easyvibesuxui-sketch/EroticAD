import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'

import { pointAtDistance } from '../lib/layout.js'

/*
 *  The mark, bent along a route.
 *
 *  The same four things the straight mark says — dashed guide, solid trail
 *  behind, terminus at the end, ring with a chevron riding it — laid along an
 *  arbitrary polyline instead of a line or a circle.
 *
 *  It exists for an action that is neither a pull nor a turn. A tongue at a
 *  stream of water goes back and forth, and a straight line through that says
 *  the wrong thing about it; the guide should be the shape of the movement.
 *
 *  The chevron is kept tangent to whichever segment the ring is on, so at every
 *  corner it turns to point down the next one — which is how the route tells
 *  the hand that it changes direction here.
 *
 *  Nothing here re-renders while the hand moves; the section drives it straight
 *  into the DOM through the imperative handle.
 */

const RING_R = 18
const TERMINUS_R = 3.5
const PAD = 26

const PathMark = forwardRef(function PathMark({ path }, ref) {
  const rootRef = useRef(null)
  const handleRef = useRef(null)
  const progressRef = useRef(null)
  const guideRef = useRef(null)
  const trailRef = useRef(null)

  const geometry = useMemo(() => {
    const xs = path.points.map((p) => p.x)
    const ys = path.points.map((p) => p.y)
    // The SVG is placed by its own origin, so the box has to hold whatever the
    // route does either side of it, plus the ring that rides it.
    const minX = Math.min(...xs) - RING_R - PAD
    const minY = Math.min(...ys) - RING_R - PAD
    const width = Math.max(...xs) + RING_R + PAD - minX
    const height = Math.max(...ys) + RING_R + PAD - minY
    const d = path.points
      .map((p, i) => `${i ? 'L' : 'M'} ${p.x - minX} ${p.y - minY}`)
      .join(' ')
    const end = path.points[path.points.length - 1]
    return { minX, minY, width, height, d, endX: end.x - minX, endY: end.y - minY }
  }, [path])

  const ringArc = useMemo(() => 2 * Math.PI * RING_R, [])

  useImperativeHandle(
    ref,
    () => ({
      place(x, y) {
        const root = rootRef.current
        if (!root) return
        // The origin of the route is the film hotspot, so the box is offset by
        // however far the route reaches back and up from it.
        root.style.left = `${x + geometry.minX}px`
        root.style.top = `${y + geometry.minY}px`
      },

      /**
       * @param {number} presence 0..1 — how much of the mark exists yet
       * @param {number} progress 0..1 — how far along the route the hand is
       * @param {boolean} live    the hand is on it right now
       */
      paint(presence, progress, live) {
        const root = rootRef.current
        if (!root) return

        root.style.opacity = String(presence)

        if (handleRef.current) {
          const at = pointAtDistance(path.points, path.cum, progress * path.length)
          handleRef.current.setAttribute(
            'transform',
            `translate(${at.x - geometry.minX} ${at.y - geometry.minY}) rotate(${at.angle})`,
          )
        }
        if (progressRef.current) {
          progressRef.current.style.strokeDashoffset = String(ringArc * (1 - progress))
        }
        if (guideRef.current) {
          // The guide fades as it is used up — there is less left to say.
          guideRef.current.style.opacity = String(0.5 - progress * 0.34 + (live ? 0.2 : 0))
        }
        if (trailRef.current) {
          trailRef.current.style.strokeDashoffset = String(path.length * (1 - progress))
        }
      },
    }),
    [geometry, path, ringArc],
  )

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute"
      style={{ left: 0, top: 0, opacity: 0 }}
    >
      <svg
        width={geometry.width}
        height={geometry.height}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        className="overflow-visible"
        style={{
          /* A gold glow alone vanishes on bright footage — this is the first
             sunlit shot in the film and the guide all but disappeared on it. The
             dark shadow under it is the same bargain the type makes. */
          filter:
            'drop-shadow(0 1px 2px rgba(4,2,3,0.9)) drop-shadow(0 0 8px rgba(217,164,65,0.35))',
        }}
        aria-hidden="true"
      >
        <path
          ref={guideRef}
          d={geometry.d}
          fill="none"
          stroke="#d9a441"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.5 6"
          className="animate-dashFlow"
          style={{ opacity: 0.5 }}
        />
        <path
          ref={trailRef}
          d={geometry.d}
          fill="none"
          stroke="#f2dcae"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.5"
          style={{ strokeDasharray: path.length, strokeDashoffset: path.length }}
        />
        <circle cx={geometry.endX} cy={geometry.endY} r={TERMINUS_R} fill="#e8c684" opacity="0.9" />

        <g ref={handleRef} transform="translate(0 0)">
          <circle
            r={RING_R}
            fill="rgba(10,5,7,0.22)"
            stroke="#d9a441"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          <circle
            ref={progressRef}
            r={RING_R}
            fill="none"
            stroke="#f2dcae"
            strokeWidth="1.7"
            strokeLinecap="round"
            transform="rotate(-90)"
            style={{ strokeDasharray: ringArc, strokeDashoffset: ringArc }}
          />
          <path
            d="M -3.5 -5.5 L 3 0 L -3.5 5.5"
            fill="none"
            stroke="#f2dcae"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  )
})

export default PathMark
