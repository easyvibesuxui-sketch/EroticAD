import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'

/*
 *  The mark, bent into a circle.
 *
 *  Everything the straight mark says, said around a centre: a dashed arc for
 *  where the hand goes, a solid one growing behind it for how far it has come,
 *  a terminus where it ends, and the same ring-with-a-chevron riding it with
 *  its own progress closing around it.
 *
 *  It exists because not every action is a pull. Two hands rolling a hem down
 *  turn about a point, and a straight line through that is a lie about the
 *  movement — the guide should be the shape of the thing it is guiding.
 *
 *  The chevron is kept tangent to the arc, so it always points the way the hand
 *  is being asked to go. Turn the ring over — a negative `spin` — and it points
 *  the other way round with no other change.
 *
 *  Nothing here re-renders while the hand moves; the section drives it straight
 *  into the DOM through the imperative handle.
 */

const RING_R = 18
const TERMINUS_R = 3.5
const PAD = 6

const rad = (deg) => (deg * Math.PI) / 180

const RingMark = forwardRef(function RingMark(
  { radius = 150, sweep = 250, start = -140, spin = 1 },
  ref,
) {
  const rootRef = useRef(null)
  const handleRef = useRef(null)
  const progressRef = useRef(null)
  const guideRef = useRef(null)
  const trailRef = useRef(null)

  const reach = radius + RING_R + PAD
  const size = reach * 2
  const c = reach

  const geometry = useMemo(() => {
    const end = start + spin * sweep
    const at = (deg) => [c + radius * Math.cos(rad(deg)), c + radius * Math.sin(rad(deg))]
    const [x0, y0] = at(start)
    const [x1, y1] = at(end)
    // An SVG arc needs to be told whether it is the long way round and which
    // way it turns; both fall straight out of the sweep and the spin.
    const large = Math.abs(sweep) > 180 ? 1 : 0
    const sweepFlag = spin > 0 ? 1 : 0
    return {
      d: `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} ${sweepFlag} ${x1} ${y1}`,
      arcLen: 2 * Math.PI * radius * (Math.abs(sweep) / 360),
      terminus: [x1, y1],
    }
  }, [c, radius, spin, start, sweep])

  const ringArc = useMemo(() => 2 * Math.PI * RING_R, [])

  useImperativeHandle(
    ref,
    () => ({
      place(x, y) {
        const root = rootRef.current
        if (!root) return
        root.style.left = `${x}px`
        root.style.top = `${y}px`
      },

      /**
       * @param {number} presence 0..1 — how much of the mark exists yet
       * @param {number} progress 0..1 — how far the action has been turned
       * @param {boolean} live    the hand is on it right now
       */
      paint(presence, progress, live) {
        const root = rootRef.current
        if (!root) return

        root.style.opacity = String(presence)
        root.style.transform = `translate(-50%, -50%) scale(${0.9 + presence * 0.1})`

        if (handleRef.current) {
          // Round to where the hand has got, then turn the chevron to face the
          // way it is going: tangent to the arc, which is a quarter turn off
          // the radius, and the other quarter when the ring is turned over.
          const angle = start + spin * sweep * progress
          handleRef.current.setAttribute(
            'transform',
            `rotate(${angle} ${c} ${c}) translate(${radius} 0) rotate(${spin > 0 ? 90 : -90} ${c} ${c})`,
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
          trailRef.current.style.strokeDashoffset = String(geometry.arcLen * (1 - progress))
        }
      },
    }),
    [c, geometry.arcLen, radius, ringArc, spin, start, sweep],
  )

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute"
      style={{ left: 0, top: 0, opacity: 0, transform: 'translate(-50%, -50%)' }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        style={{ filter: 'drop-shadow(0 0 8px rgba(217,164,65,0.35))' }}
        aria-hidden="true"
      >
        <path
          ref={guideRef}
          d={geometry.d}
          fill="none"
          stroke="#d9a441"
          strokeWidth="1.2"
          strokeLinecap="round"
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
          strokeOpacity="0.5"
          style={{ strokeDasharray: geometry.arcLen, strokeDashoffset: geometry.arcLen }}
        />
        <circle
          cx={geometry.terminus[0]}
          cy={geometry.terminus[1]}
          r={TERMINUS_R}
          fill="#e8c684"
          opacity="0.9"
        />

        <g ref={handleRef} transform={`rotate(${start} ${c} ${c}) translate(${radius} 0)`}>
          <circle
            cx={c}
            cy={c}
            r={RING_R}
            fill="rgba(10,5,7,0.22)"
            stroke="#d9a441"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          <circle
            ref={progressRef}
            cx={c}
            cy={c}
            r={RING_R}
            fill="none"
            stroke="#f2dcae"
            strokeWidth="1.7"
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
            style={{ strokeDasharray: ringArc, strokeDashoffset: ringArc }}
          />
          <path
            d={`M ${c - 3.5} ${c - 5.5} L ${c + 3} ${c} L ${c - 3.5} ${c + 5.5}`}
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

export default RingMark
