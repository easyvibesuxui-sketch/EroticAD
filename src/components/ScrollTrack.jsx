import { SECTIONS } from '../lib/sections.js'

/**
 * The ten sections are empty. They exist to be scrolled through — the film is
 * on a fixed stage behind them, and the scroll position is the only thing they
 * contribute. Their copy rides on top.
 *
 * Only the section you are on is legible; the rest are held at zero so the
 * frame stays clean. Nothing here is a scroll listener: the active index comes
 * from one place and changes ten times in the life of the page.
 */
import { forwardRef } from 'react'

/** Sections are sized in `svh` where it exists: on a phone `vh` changes as the
 *  URL bar hides, which quietly desynchronises every section boundary. */
const SECTION_HEIGHT = { height: '100svh' }

const ScrollTrack = forwardRef(function ScrollTrack({ active, committedIds }, ref) {
  return (
    <div ref={ref} className="relative z-20">
      {SECTIONS.map((section) => {
        const isActive = section.index === active
        const done = committedIds.has(section.id)
        return (
          <section
            key={section.id}
            id={section.id}
            data-active={isActive}
            className="pointer-events-none relative h-screen"
            style={SECTION_HEIGHT}
            aria-hidden={!isActive}
          >
            <div
              className="absolute bottom-24 left-6 max-w-xs transition-all duration-[900ms] ease-silk sm:bottom-28 sm:left-12"
              style={{
                opacity: isActive ? 1 : 0,
                transform: `translateY(${isActive ? 0 : 18}px)`,
                filter: isActive ? 'blur(0)' : 'blur(8px)',
              }}
            >
              <p className="font-sans text-[0.55rem] font-light uppercase tracking-widest3 text-gold-400/70">
                {section.title}
              </p>
              <p className="mt-4 font-serif text-2xl font-light italic leading-snug text-blush/90 sm:text-[1.75rem]">
                {section.caption}
              </p>
              <p
                className="mt-4 font-sans text-[0.56rem] font-light uppercase tracking-widest2 text-blush/40 transition-opacity duration-700"
                style={{ opacity: done ? 1 : 0 }}
              >
                Done — keep scrolling
              </p>
            </div>
          </section>
        )
      })}

      {/* the last screen: the film has been undone, now buy it */}
      <section
        className="relative flex h-screen flex-col items-center justify-center gap-8 px-6 text-center"
        style={SECTION_HEIGHT}
      >
        <p className="font-sans text-[0.55rem] font-light uppercase tracking-widest3 text-gold-400/70">
          Ten of ten
        </p>
        <h2 className="max-w-lg text-balance font-serif text-3xl font-light italic leading-tight text-blush sm:text-4xl">
          You took all of it off.
        </h2>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
          <a
            href="#full-scene"
            className="group relative overflow-hidden border border-blush/30 bg-void/40 px-12 py-4 font-sans text-[0.66rem] font-light uppercase tracking-widest2 text-blush backdrop-blur-sm transition-all duration-700 ease-silk hover:border-blush/70 hover:bg-crimson-700/30"
          >
            <span className="relative z-10">Watch the full scene</span>
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-blush/20 to-transparent" />
          </a>
          <a
            href="#shop"
            className="border-b border-gold-400/40 pb-1 font-sans text-[0.66rem] font-light uppercase tracking-widest2 text-gold-300/80 transition-colors duration-700 ease-silk hover:border-gold-200 hover:text-blush"
          >
            Shop the look
          </a>
        </div>
      </section>
    </div>
  )
})

export default ScrollTrack
