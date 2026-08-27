import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'

import { DIRECTION_ANGLE } from '../lib/layout.js'

/*
 *  A mark on the film.
 *
 *  pull   ring + chevron + dashed path + terminus. The ring rides the dashes
 *         as you drag, and the progress arc closes around it.
 *  dwell  a bare dot inside a dashed circle that closes while you rest on it.
 *
 *  Nothing here re-renders while the hand moves: the layer above drives every
 *  frame straight into the DOM through the imperative handle.
 */

const RING_R = 17
const GAP = 7
const TERMINUS_R = 3
const DWELL_R = 15
const PAD = 3

const circumference = (r) => 2 * Math.PI * r

const Trace = forwardRef(function Trace({ trace }, ref) {
  const rootRef = useRef(null)
  const handleRef = useRef(null)
  const progressRef = useRef(null)
  const pathRef = useRef(null)
  const labelRef = useRef(null)

  const isPull = trace.kind === 'pull'
  const length = isPull ? trace.length : 0
  const reach = isPull ? RING_R + GAP + length + TERMINUS_R + PAD : DWELL_R + PAD + 2
  const size = reach * 2
  const c = reach
  const angle = isPull ? DIRECTION_ANGLE[trace.dir] : 0
  const arcR = isPull ? RING_R : DWELL_R
  const arcLen = useMemo(() => circumference(arcR), [arcR])

  useImperativeHandle(
    ref,
    () => ({
      /** Put the mark where the film says it belongs. */
      place(x, y) {
        const root = rootRef.current
        if (!root) return
        root.style.left = `${x}px`
        root.style.top = `${y}px`

        // A mark low in frame hangs its label above itself instead.
        const label = labelRef.current
        if (label) {
          const above = y > window.innerHeight * 0.62
          label.style.top = above ? 'auto' : '100%'
          label.style.bottom = above ? '100%' : 'auto'
          label.style.paddingTop = above ? '0' : '12px'
          label.style.paddingBottom = above ? '12px' : '0'
        }
      },

      /**
       * @param {number} presence 0..1 — how much of the mark exists yet
       * @param {number} armed    0..1 — the hand is close enough to take it
       * @param {number} progress 0..1 — pull travelled, or dwell elapsed
       * @param {boolean} opened
       */
      paint(presence, armed, progress, opened) {
        const root = rootRef.current
        if (!root) return

        root.style.opacity = String(presence * (opened ? 1 : 0.35 + armed * 0.65))
        root.style.transform = `translate(-50%, -50%) scale(${0.86 + presence * 0.14 + armed * 0.06})`

        if (handleRef.current && isPull) {
          // The ring rides its own dashes.
          const travel = progress * length
          handleRef.current.style.transform = `rotate(${angle}deg) translateX(${travel}px)`
        }
        if (progressRef.current) {
          progressRef.current.style.strokeDashoffset = String(arcLen * (1 - progress))
        }
        if (pathRef.current) {
          pathRef.current.style.opacity = String(0.25 + armed * 0.55 - progress * 0.2)
        }
        if (labelRef.current) {
          labelRef.current.dataset.visible = opened ? 'true' : 'false'
        }
      },
    }),
    [angle, arcLen, isPull, length],
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
        style={{ filter: 'drop-shadow(0 0 7px rgba(217,164,65,0.35))' }}
        aria-hidden="true"
      >
        {isPull && (
          <g transform={`rotate(${angle} ${c} ${c})`}>
            {/* the guide: dashes crawl toward the terminus */}
            <line
              ref={pathRef}
              x1={c + RING_R + GAP}
              y1={c}
              x2={c + RING_R + GAP + length}
              y2={c}
              stroke="#d9a441"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeDasharray="1.5 6"
              className="animate-dashFlow"
              style={{ opacity: 0.3 }}
            />
            <circle
              cx={c + RING_R + GAP + length}
              cy={c}
              r={TERMINUS_R}
              fill="#e8c684"
              opacity="0.85"
            />
          </g>
        )}

        {/* the handle — what the hand is actually holding */}
        <g
          ref={handleRef}
          style={{ transformOrigin: `${c}px ${c}px`, transform: `rotate(${angle}deg)` }}
        >
          <g transform={`rotate(${-angle} ${c} ${c})`}>
            <circle
              cx={c}
              cy={c}
              r={arcR}
              fill="rgba(10,5,7,0.18)"
              stroke="#d9a441"
              strokeWidth="1"
              strokeOpacity="0.55"
              strokeDasharray={isPull ? undefined : '2 5'}
            />
            <circle
              ref={progressRef}
              cx={c}
              cy={c}
              r={arcR}
              fill="none"
              stroke="#f2dcae"
              strokeWidth="1.6"
              strokeLinecap="round"
              transform={`rotate(-90 ${c} ${c})`}
              style={{ strokeDasharray: arcLen, strokeDashoffset: arcLen }}
            />
          </g>

          {isPull ? (
            <path
              d={`M ${c - 3.5} ${c - 5} L ${c + 3} ${c} L ${c - 3.5} ${c + 5}`}
              fill="none"
              stroke="#f2dcae"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <circle cx={c} cy={c} r="3" fill="#f2dcae" />
          )}
        </g>
      </svg>

      <div
        ref={labelRef}
        data-visible="false"
        className="materialize absolute left-1/2 top-full w-max -translate-x-1/2 pt-3 text-center"
      >
        <p className="font-serif text-lg font-light italic leading-none text-gold-200">
          {trace.label}
        </p>
        <p className="mt-2 font-sans text-[0.58rem] font-light uppercase tracking-widest2 text-gold-300/70">
          {trace.meta}
        </p>
      </div>
    </div>
  )
})

export default Trace
