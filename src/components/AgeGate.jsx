import { useEffect, useState } from 'react'

import Wordmark from './Wordmark.jsx'
import { BRAND, Spell } from '../lib/brand.js'
import { SECTIONS } from '../lib/sections.js'
import { asset } from '../lib/asset.js'

/**
 * The gate, and the only question worth asking at one.
 *
 * It holds the whole experience back — no video element is created, no texture
 * is uploaded and no audio graph exists until someone answers here. Nothing
 * from the film is on screen before this point, not even fogged: the two
 * circles are stills, treated to monochrome, and they are all anyone sees.
 *
 * The answer is not yes or no, it is which. Two versions of the same
 * collection, and you say which one you are here for — so the choice does the
 * work an age wall used to do, without the door-policy tone. Only one side
 * carries the 18+, because only one side needs it.
 */

/**
 * A single-file build has no origin to serve `/media/` from and injects the two
 * stills as data URIs instead — see `scripts/build-artifact.mjs`. Absent, which
 * is the normal served case, the paths below are used unchanged.
 */
const injected = (typeof window !== 'undefined' && window.__EROTICAD_MEDIA) || {}
const poster = (key, path) => injected[`gate:${key}`]?.[0] ?? asset(path)

const CHOICES = [
  {
    mode: 'covered',
    poster: '/media/gate/covered.jpg',
    label: 'Nothing comes off',
    note: 'The collection, worn',
    adult: false,
  },
  {
    mode: 'bare',
    poster: '/media/gate/bare.jpg',
    label: 'Everything does',
    note: 'The collection, taken off',
    adult: true,
  },
]

export default function AgeGate({ onEnter, booting }) {
  const [shown, setShown] = useState(false)
  const [chosen, setChosen] = useState(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const choose = (mode) => {
    if (booting) return
    setChosen(mode)
    onEnter(mode)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-crimson-500 px-6 py-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0 grain opacity-[0.10]" />

      <div className="materialize relative" data-visible={shown}>
        <Wordmark className="justify-center text-void/70" size={16} />
      </div>

      {/*
       * Two circles that overlap, and the question in the lens where they do.
       * Multiplied over the ground so the overlap darkens by itself rather than
       * by a third element sitting on top of them.
       */}
      <div
        className="materialize relative flex flex-col items-center sm:flex-row"
        data-visible={shown}
      >
        {CHOICES.map((c, i) => {
          const busy = booting && chosen === c.mode
          return (
            <button
              key={c.mode}
              type="button"
              data-interactive
              disabled={booting}
              onClick={() => choose(c.mode)}
              aria-label={`${c.label}. ${c.note}${c.adult ? '. Over 18 only' : ''}.`}
              className={`group relative block aspect-square w-[62vw] max-w-[26rem] rounded-full transition-transform duration-700 ease-silk focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-8 focus-visible:outline-void/60 disabled:cursor-wait sm:w-[34vw] ${
                i === 1 ? '-mt-[26vw] sm:mt-0 sm:-ml-[13vw]' : ''
              } ${booting && !busy ? 'opacity-40' : ''}`}
            >
              <span
                className="absolute inset-0 rounded-full bg-cover bg-center mix-blend-multiply transition-all duration-700 ease-silk group-hover:brightness-125 group-focus-visible:brightness-125"
                style={{ backgroundImage: `url(${poster(c.mode, c.poster)})` }}
              />
              {/* the hairline that says this is a thing you can press */}
              <span className="absolute inset-0 rounded-full border border-void/0 transition-colors duration-700 ease-silk group-hover:border-void/30 group-focus-visible:border-void/30" />
              <span
                className={`absolute inset-x-0 ${
                  i === 1 ? 'bottom-[12%]' : 'top-[12%]'
                } px-6 text-center font-sans text-[0.6rem] font-light uppercase tracking-widest2 text-blush/0 transition-colors duration-500 ease-silk group-hover:text-blush/90 group-focus-visible:text-blush/90`}
              >
                {busy ? 'Warming the glass' : c.label}
                {c.adult && <span className="ml-2 opacity-60">18+</span>}
              </span>
            </button>
          )
        })}

        <h1 className="pointer-events-none absolute left-1/2 top-1/2 w-[52vw] -translate-x-1/2 -translate-y-1/2 text-balance text-center font-serif text-xl font-light uppercase tracking-widest2 text-gold-200 sm:w-[17vw] sm:text-[1.5rem]">
          What are you into?
        </h1>
      </div>

      <div className="materialize relative max-w-md text-center" data-visible={shown}>
        <p className="font-sans text-[0.62rem] font-light leading-relaxed tracking-[0.16em] text-void/70">
          {BRAND.season}. {Spell(SECTIONS.length)} pieces. None of them will come off
          on their own.
        </p>
        <a
          data-interactive
          href="https://www.google.com"
          className="mt-4 inline-block font-sans text-[0.6rem] font-light uppercase tracking-widest2 text-void/45 transition-colors duration-500 hover:text-void/75"
        >
          Neither — take me out
        </a>
      </div>
    </div>
  )
}
