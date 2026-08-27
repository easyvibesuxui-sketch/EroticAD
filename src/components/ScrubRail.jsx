import { useEffect, useRef } from 'react'

/**
 * Rewind and forward.
 *
 * The same gold language as the marks: a dashed rail the hand runs along, a
 * ring for the hand itself, and a terminus at each end. The dashes are offset
 * by the actual distance dragged, so the rail slides under the ring exactly as
 * far as the film moves — the guide is the readout.
 */
export default function ScrubRail({ signalsRef, gestureRef, scrubRef }) {
  const rootRef = useRef(null)
  const railRef = useRef(null)
  const dashRef = useRef(null)
  const handleRef = useRef(null)
  const readoutRef = useRef(null)
  const hintsRef = useRef(null)

  useEffect(() => {
    let raf = 0
    let shown = 0
    let last = performance.now()

    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 1 / 8)
      last = now

      const g = gestureRef.current
      const s = signalsRef.current
      const sc = scrubRef.current

      const active = g.mode === 'scrub' ? 1 : 0
      // Time-based, so the rail arrives at the same speed on every frame rate.
      shown += (active - shown) * (1 - Math.exp(-dt / 0.09))

      if (rootRef.current) rootRef.current.style.opacity = String(shown)

      if (railRef.current) {
        const y = g.holding ? g.screen.y : window.innerHeight / 2
        railRef.current.style.transform = `translateY(${y}px)`
      }
      if (dashRef.current) {
        // The rail travels with the film.
        dashRef.current.style.strokeDashoffset = String(-(sc.pixels || 0))
      }
      if (handleRef.current) {
        const x = g.holding ? g.screen.x : window.innerWidth / 2
        handleRef.current.style.transform = `translateX(${x}px) scale(${0.9 + shown * 0.1})`
        handleRef.current.dataset.dir = (sc.seconds || 0) < 0 ? 'back' : 'forward'
      }
      if (readoutRef.current) {
        const sec = sc.seconds || 0
        const sign = sec < 0 ? '−' : '+'
        readoutRef.current.textContent = `${sign} ${Math.abs(sec).toFixed(1)}s`
      }
      if (hintsRef.current) {
        // Teach the gesture only once the glass is clear enough to be worth
        // scrubbing, and get out of the way the moment it is being used.
        hintsRef.current.style.opacity = String(Math.max(0, s.reveal - 0.55) * 1.4 * (1 - shown))
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gestureRef, scrubRef, signalsRef])

  return (
    <>
      {/* the invitation */}
      <div
        ref={hintsRef}
        className="pointer-events-none fixed inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-6 sm:px-12"
        style={{ opacity: 0 }}
      >
        <EdgeHint dir="back" />
        <EdgeHint dir="forward" />
      </div>

      {/* the rail itself */}
      <div
        ref={rootRef}
        className="pointer-events-none fixed inset-0 z-20"
        style={{ opacity: 0 }}
      >
        <div ref={railRef} className="absolute inset-x-0 top-0 -translate-y-1/2">
          <svg className="h-6 w-full overflow-visible" aria-hidden="true">
            <line
              ref={dashRef}
              x1="0"
              y1="12"
              x2="100%"
              y2="12"
              stroke="#d9a441"
              strokeWidth="1"
              strokeOpacity="0.45"
              strokeLinecap="round"
              strokeDasharray="1.5 9"
            />
          </svg>

          <div
            ref={handleRef}
            data-dir="forward"
            className="group absolute left-0 top-3 -translate-y-1/2"
          >
            <div className="relative -ml-[22px] -mt-[22px] flex h-11 w-11 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-gold-400/70 bg-void/25 backdrop-blur-[2px]" />
              <span className="absolute inset-0 animate-breathRing rounded-full border border-gold-300/30" />
              <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true">
                <g
                  stroke="#f2dcae"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="origin-center group-data-[dir=back]:rotate-180"
                >
                  <path d="M4 1.5 L9 6 L4 10.5" />
                  <path d="M9.5 1.5 L14.5 6 L9.5 10.5" opacity="0.55" />
                </g>
              </svg>
            </div>

            <p
              ref={readoutRef}
              className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-base font-light italic text-gold-200"
            >
              + 0.0s
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function EdgeHint({ dir }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width="16"
        height="11"
        viewBox="0 0 18 12"
        fill="none"
        aria-hidden="true"
        style={{ transform: dir === 'back' ? 'rotate(180deg)' : undefined }}
      >
        <g stroke="#d9a441" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 1.5 L9 6 L4 10.5" />
          <path d="M9.5 1.5 L14.5 6 L9.5 10.5" opacity="0.5" />
        </g>
      </svg>
      <span className="font-sans text-[0.5rem] font-light uppercase tracking-widest2 text-gold-400/60">
        {dir === 'back' ? 'Rewind' : 'Forward'}
      </span>
    </div>
  )
}
