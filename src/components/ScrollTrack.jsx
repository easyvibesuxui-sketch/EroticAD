import { forwardRef } from 'react'

import { BRAND, price } from '../lib/brand.js'
import { SECTIONS } from '../lib/sections.js'

/**
 * The ten sections are empty. They exist to be scrolled through — the film is
 * on a fixed stage behind them, and the scroll position is the only thing they
 * contribute. Their copy rides on top.
 *
 * Each carries the same block of type twice: a line about the film, and the
 * piece it was. The first gives way to the second the moment the action is
 * performed, which is the commercial argument of the whole site — you take it
 * off, and only then are you told what it was and what it costs.
 *
 * Only the section you are on is legible; the rest are held at zero so the
 * frame stays clean. Nothing here is a scroll listener: the active index comes
 * from one place and changes ten times in the life of the page.
 */

/** Sections are sized in `svh` where it exists: on a phone `vh` changes as the
 *  URL bar hides, which quietly desynchronises every section boundary. */
const SECTION_HEIGHT = { height: '100svh' }

/**
 * Type sits over skin, which is the brightest thing in the frame. The
 * legibility is bought in the type itself rather than by laying a scrim over
 * the film — the film is the product, and nothing here is allowed to dim it.
 */
const ON_FILM = {
  textShadow: '0 1px 2px rgba(4,2,3,0.85), 0 2px 22px rgba(4,2,3,0.75)',
}

const ScrollTrack = forwardRef(function ScrollTrack({ active, committedIds }, ref) {
  return (
    /* The track itself must not take the pointer: with a mouse the whole frame
       is the mark's handle, and this container sits above it. Only the last
       screen, which has buttons and no drag, takes its clicks back. */
    <div ref={ref} className="pointer-events-none relative z-20">
      {SECTIONS.map((section) => {
        const isActive = section.index === active
        const done = committedIds.has(section.id)
        const product = section.product
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
              className="absolute bottom-24 left-6 w-[min(21rem,calc(100vw-3rem))] transition-all duration-[900ms] ease-silk sm:bottom-28 sm:left-12"
              style={{
                opacity: isActive ? 1 : 0,
                transform: `translateY(${isActive ? 0 : 18}px)`,
                filter: isActive ? 'blur(0)' : 'blur(8px)',
                ...ON_FILM,
              }}
            >
              {/* the film's line — retires once the piece is off */}
              <div
                className="transition-all duration-700 ease-silk"
                style={{
                  opacity: done ? 0 : 1,
                  transform: `translateY(${done ? -10 : 0}px)`,
                  position: done ? 'absolute' : 'relative',
                }}
              >
                <p className="font-sans text-[0.55rem] font-light uppercase tracking-widest3 text-gold-400/80">
                  {section.title}
                </p>
                <p className="mt-4 font-serif text-2xl font-light italic leading-snug text-blush sm:text-[1.75rem]">
                  {section.caption}
                </p>
              </div>

              {/* and then the piece it was */}
              {product && (
                <div
                  className="transition-all duration-[1100ms] ease-silk"
                  style={{
                    opacity: done ? 1 : 0,
                    transform: `translateY(${done ? 0 : 14}px)`,
                    filter: done ? 'blur(0)' : 'blur(6px)',
                    pointerEvents: done && isActive ? 'auto' : 'none',
                  }}
                >
                  <p
                    className="font-sans text-[0.55rem] font-normal uppercase tracking-widest3 text-gold-200"
                    style={{ textShadow: '0 1px 3px rgba(4,2,3,0.95), 0 2px 16px rgba(4,2,3,0.9)' }}
                  >
                    {BRAND.season}
                  </p>
                  <h2 className="mt-4 font-serif text-3xl font-light leading-none text-blush sm:text-4xl">
                    {product.name}
                  </h2>
                  <p className="mt-3 font-sans text-[0.62rem] font-light leading-relaxed tracking-[0.14em] text-blush/70">
                    {product.note}
                  </p>
                  <p className="mt-1.5 font-sans text-[0.56rem] font-light uppercase tracking-widest2 text-gold-400/75">
                    {product.edition}
                  </p>

                  <div className="mt-6 flex items-center gap-6">
                    <button
                      type="button"
                      data-interactive
                      className="border border-gold-400/50 bg-void/25 px-8 py-3 font-sans text-[0.62rem] font-light uppercase tracking-widest2 text-blush backdrop-blur-[2px] transition-colors duration-500 ease-silk hover:border-gold-300 hover:bg-crimson-700/30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-gold-400"
                    >
                      Add to bag
                    </button>
                    <span className="font-serif text-xl font-light tabular-nums text-gold-200">
                      {price(product.price)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )
      })}

      {/* the last screen: every piece is off, now buy them */}
      <section
        className="pointer-events-auto relative flex h-screen flex-col items-center justify-center gap-8 px-6 text-center"
        style={{ ...SECTION_HEIGHT, ...ON_FILM }}
      >
        <p className="font-sans text-[0.55rem] font-light uppercase tracking-widest3 text-gold-400/80">
          {BRAND.season}
        </p>
        <h2 className="max-w-lg text-balance font-serif text-3xl font-light italic leading-tight text-blush sm:text-4xl">
          Ten pieces. You took all of them off.
        </h2>
        <p className="max-w-sm font-sans text-[0.62rem] font-light leading-relaxed tracking-[0.16em] text-blush/60">
          Each made to order in a numbered edition. Nothing is restocked.
        </p>
        <div className="mt-2 flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
          <a
            href="#collection"
            data-interactive
            className="group relative overflow-hidden border border-blush/30 bg-void/40 px-12 py-4 font-sans text-[0.66rem] font-light uppercase tracking-widest2 text-blush backdrop-blur-sm transition-all duration-700 ease-silk hover:border-blush/70 hover:bg-crimson-700/30"
          >
            <span className="relative z-10">Shop the collection</span>
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-blush/20 to-transparent" />
          </a>
          <a
            href="#atelier"
            data-interactive
            className="border-b border-gold-400/40 pb-1 font-sans text-[0.66rem] font-light uppercase tracking-widest2 text-gold-300/85 transition-colors duration-700 ease-silk hover:border-gold-200 hover:text-blush"
          >
            The atelier
          </a>
        </div>
      </section>
    </div>
  )
})

export default ScrollTrack
