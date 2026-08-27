import { useEffect, useState } from 'react'

/**
 * The gate holds the whole experience back — no video element is created, no
 * texture is uploaded and no audio graph exists until someone confirms their
 * age here. Nothing explicit is ever on screen before this point, not even
 * fogged.
 */
export default function AgeGate({ onEnter, booting }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-void">
      {/* Warmth, somewhere behind the curtain. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[140vmin] w-[140vmin] -translate-x-1/2 -translate-y-1/2 animate-pulseGlow rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(163,43,69,0.55) 0%, rgba(130,18,44,0.30) 30%, rgba(60,6,20,0.12) 55%, rgba(4,2,3,0) 74%)',
        }}
      />
      {/* A second, tighter ember right behind the question. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle, rgba(196,83,107,0.28) 0%, rgba(92,10,30,0.14) 45%, rgba(4,2,3,0) 72%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 vignette" />
      <div className="pointer-events-none absolute inset-0 grain opacity-[0.14]" />

      <div
        className="materialize relative w-full max-w-xl px-8 text-center"
        data-visible={shown}
      >
        <p className="font-sans text-[0.6rem] font-light uppercase tracking-widest3 text-crimson-400/80">
          Eroticad
        </p>

        <div className="mx-auto mt-7 h-px w-24 rule-fade" />

        <h1 className="mt-9 font-serif text-4xl font-light leading-[1.25] text-blush sm:text-5xl">
          Are you over 18?
          <span className="mt-3 block italic text-crimson-200/70">
            Touch and hold to reveal.
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-sm font-sans text-[0.72rem] font-light leading-relaxed tracking-[0.18em] text-smoke/50">
          Explicit material. Sound on, headphones warmer.
          <br />
          Nothing plays until you say yes.
        </p>

        <div className="mt-12 flex flex-col items-center gap-6">
          <button
            type="button"
            data-interactive
            disabled={booting}
            onClick={onEnter}
            className="group relative overflow-hidden border border-crimson-500/40 px-14 py-4 font-sans text-[0.68rem] font-light uppercase tracking-widest2 text-blush/90 transition-all duration-700 ease-silk hover:border-crimson-400 hover:text-blush disabled:cursor-wait disabled:opacity-60"
          >
            <span className="relative z-10">
              {booting ? 'Warming the glass' : 'Yes — let me in'}
            </span>
            <span className="absolute inset-0 bg-gradient-to-b from-crimson-700/20 to-crimson-900/40 opacity-70 transition-opacity duration-700 ease-silk group-hover:opacity-100" />
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 z-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-crimson-200/15 to-transparent" />
          </button>

          <a
            data-interactive
            href="https://www.google.com"
            className="font-sans text-[0.62rem] font-light uppercase tracking-widest2 text-smoke/40 transition-colors duration-500 hover:text-smoke/70"
          >
            No — take me out
          </a>
        </div>
      </div>
    </div>
  )
}
