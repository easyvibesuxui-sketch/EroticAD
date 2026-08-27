import { useEffect, useRef } from 'react'

/**
 * The interface never re-renders on a frame. It subscribes to the same signals
 * object the shader writes and paints straight into style properties — React
 * only hears about the two transitions that matter (clear held / not held).
 */
export default function Overlay({ signalsRef, ctaVisible }) {
  const hintRef = useRef(null)
  const meterRef = useRef(null)
  const chromeRef = useRef(null)
  const holdMarkRef = useRef(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const s = signalsRef.current
      const fogged = 1 - s.reveal

      if (hintRef.current) {
        // The instruction excuses itself the moment it is obeyed.
        hintRef.current.style.opacity = String(Math.pow(fogged, 1.4) * 0.9)
        hintRef.current.style.letterSpacing = `${0.42 + s.reveal * 0.25}em`
      }
      if (meterRef.current) {
        meterRef.current.style.transform = `scaleX(${s.reveal})`
        meterRef.current.style.opacity = String(0.25 + s.reveal * 0.75)
      }
      if (holdMarkRef.current) {
        const beat = 1 + s.pulse * 0.35 * fogged
        holdMarkRef.current.style.transform = `scale(${beat})`
        holdMarkRef.current.style.opacity = String(0.2 + s.pulse * 0.5 * fogged)
      }
      if (chromeRef.current) {
        chromeRef.current.style.opacity = String(0.35 + s.reveal * 0.65)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [signalsRef])

  return (
    <div className="pointer-events-none fixed inset-0 z-30 select-none">
      <div className="pointer-events-none absolute inset-0 vignette" />
      <div className="pointer-events-none absolute inset-0 grain opacity-[0.10]" />

      {/* chrome */}
      <div
        ref={chromeRef}
        className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-6 transition-opacity duration-700 sm:px-10 sm:py-8"
      >
        <span className="font-sans text-[0.6rem] font-light uppercase tracking-widest3 text-blush/70">
          Eroticad
        </span>
        <span className="font-sans text-[0.6rem] font-light uppercase tracking-widest2 text-crimson-400/70">
          18+
        </span>
      </div>

      {/* the instruction, and the pulse under it */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 px-6 pb-10 sm:pb-14">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <span
            ref={holdMarkRef}
            className="absolute h-10 w-10 rounded-full border border-crimson-400/50"
          />
          <span className="h-1 w-1 rounded-full bg-crimson-200/70" />
        </div>

        <p
          ref={hintRef}
          className="font-sans text-[0.62rem] font-light uppercase tracking-widest2 text-blush/80"
        >
          Touch and hold to reveal
        </p>

        <div className="h-px w-40 overflow-hidden bg-blush/10 sm:w-56">
          <span
            ref={meterRef}
            className="block h-full w-full origin-left bg-gradient-to-r from-crimson-500 via-crimson-400 to-blush"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>
      </div>

      {/* the climax: only after the glass has stayed clear */}
      <div
        className="materialize absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-7 px-6"
        data-visible={ctaVisible}
        aria-hidden={!ctaVisible}
      >
        <p className="font-serif text-2xl font-light italic leading-tight text-blush/90 sm:text-3xl">
          Stay a little longer.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <a
            data-interactive
            href="#full-scene"
            tabIndex={ctaVisible ? 0 : -1}
            className="group relative overflow-hidden border border-blush/30 bg-void/30 px-12 py-4 font-sans text-[0.66rem] font-light uppercase tracking-widest2 text-blush backdrop-blur-sm transition-all duration-700 ease-silk hover:border-blush/70 hover:bg-crimson-700/30"
          >
            <span className="relative z-10">Watch the full scene</span>
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-blush/20 to-transparent" />
          </a>

          <a
            data-interactive
            href="#shop"
            tabIndex={ctaVisible ? 0 : -1}
            className="border-b border-crimson-400/40 pb-1 font-sans text-[0.66rem] font-light uppercase tracking-widest2 text-crimson-200/80 transition-colors duration-700 ease-silk hover:border-crimson-200 hover:text-blush"
          >
            Shop the look
          </a>
        </div>
      </div>
    </div>
  )
}
