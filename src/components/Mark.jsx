import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'

import { DIRECTION_ANGLE } from '../lib/layout.js'

/*
 *  The mark: a ring with a chevron, a dashed path, and a terminus.
 *
 *  It says one thing — the hand goes this way, this far. The ring rides its own
 *  dashes as the action winds on and the arc closes around it, so the control
 *  shows its own position without a separate progress bar.
 *
 *  Nothing here re-renders while the hand moves; the section drives it straight
 *  into the DOM through the imperative handle.
 */

const RING_R = 18
const GAP = 8
const TERMINUS_R = 3.5
const PAD = 4

const Mark = forwardRef(function Mark({ dir = 'right', length = 96 }, ref) {
  const rootRef = useRef(null)
  const handleRef = useRef(null)
  const progressRef = useRef(null)
  const pathRef = useRef(null)
  const trailRef = useRef(null)

  // `length` is how far the ring's *centre* travels, which is also what the
  // drag maps onto — so the terminus sits at exactly that distance and the
  // ring finishes centred on it. Measuring the dashes instead would leave the
  // ring a radius-and-a-gap short of the dot it is being dragged to.
  const reach = length + RING_R + PAD
  const size = reach * 2
  const c = reach
  const angle = DIRECTION_ANGLE[dir] ?? 0
  const arcLen = useMemo(() => 2 * Math.PI * RING_R, [])

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
       * @param {number} progress 0..1 — how far the action has been wound
       * @param {boolean} live    the hand is on it right now
       */
      paint(presence, progress, live) {
        const root = rootRef.current
        if (!root) return

        root.style.opacity = String(presence)
        root.style.transform = `translate(-50%, -50%) scale(${0.9 + presence * 0.1})`

        if (handleRef.current) {
          const travel = progress * length
          handleRef.current.style.transform = `rotate(${angle}deg) translateX(${travel}px)`
        }
        if (progressRef.current) {
          progressRef.current.style.strokeDashoffset = String(arcLen * (1 - progress))
        }
        if (pathRef.current) {
          // The guide fades as it is used up — there is less left to say.
          pathRef.current.style.opacity = String(0.5 - progress * 0.34 + (live ? 0.2 : 0))
        }
        if (trailRef.current) {
          // A solid line grows behind the ring: the distance already travelled.
          trailRef.current.style.transform = `scaleX(${progress})`
        }
      },
    }),
    [angle, arcLen, length],
  )

  const pathStart = c + RING_R + GAP
  const pathEnd = c + length

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
        <g transform={`rotate(${angle} ${c} ${c})`}>
          <line
            ref={pathRef}
            x1={pathStart}
            y1={c}
            x2={pathEnd}
            y2={c}
            stroke="#d9a441"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="1.5 6"
            className="animate-dashFlow"
            style={{ opacity: 0.5 }}
          />
          <line
            ref={trailRef}
            x1={pathStart}
            y1={c}
            x2={pathEnd}
            y2={c}
            stroke="#f2dcae"
            strokeWidth="1"
            strokeLinecap="round"
            strokeOpacity="0.5"
            style={{ transformOrigin: `${pathStart}px ${c}px`, transform: 'scaleX(0)' }}
          />
          <circle cx={pathEnd} cy={c} r={TERMINUS_R} fill="#e8c684" opacity="0.9" />
        </g>

        <g
          ref={handleRef}
          style={{ transformOrigin: `${c}px ${c}px`, transform: `rotate(${angle}deg)` }}
        >
          <g transform={`rotate(${-angle} ${c} ${c})`}>
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
              style={{ strokeDasharray: arcLen, strokeDashoffset: arcLen }}
            />
          </g>
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

export default Mark
