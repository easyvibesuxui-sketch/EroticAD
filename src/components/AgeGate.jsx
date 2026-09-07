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
 * lozenges are stills, treated to monochrome, and they are all anyone sees.
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

/** Corner to corner, so the shape's points reach the edges of its own box. */
const RHOMBUS = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'

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

/**
 * The label is a sibling of its button, not a child of it.
 *
 * It has to be: the button is clipped to the rhombus, and `clip-path` takes the
 * text with it — hung above or below, a label inside would simply be cut away.
 * It follows the button through `peer-hover` instead of `group-hover`, which
 * costs nothing and is in fact more accurate, since a peer only lights up when
 * the shape itself is under the hand.
 */
function Label({ busy, choice, above }) {
  return (
    <span
      className={`pointer-events-none absolute left-1/2 w-max -translate-x-1/2 text-center font-sans text-[0.62rem] font-light uppercase tracking-widest2 text-void/70 transition-colors duration-500 ease-silk peer-hover:text-void peer-focus-visible:text-void ${
        above ? '-top-9' : '-bottom-9'
      }`}
    >
      {busy ? 'Warming the glass' : choice.label}
      {choice.adult && <span className="ml-2 text-gold-200">18+</span>}
    </span>
  )
}

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
       * Two lozenges that overlap, and the question in the lens where they do.
       * Multiplied over the ground so the overlap darkens by itself rather than
       * by a third element sitting on top of them.
       *
       * They are rhombi rather than circles, and they meet rather than merge:
       * two circles overlapping by two fifths of their width read as one
       * blurred mass with a bright seam, and you could no longer see that there
       * were two things to choose between. A rhombus tapers to its corners, so
       * the same amount of contact leaves a small, sharp lens instead of a wide
       * one — the shapes stay legibly two, and the question sits in the join.
       */}
      <div
        className="materialize relative flex flex-col items-center sm:flex-row"
        data-visible={shown}
      >
        {CHOICES.map((c, i) => {
          const busy = booting && chosen === c.mode
          return (
            /*
             * The box is square; only what is inside the rhombus answers to the
             * hand. `clip-path` is on the button itself, so the four corners of
             * the box — bare ground, and next to the other shape's corners at
             * that — are neither clickable nor hoverable. A circle got this for
             * free from `border-radius`; a clipped shape has to be told.
             */
            <div
              key={c.mode}
              className={`relative aspect-square w-[64vw] max-w-[26rem] ${
                i === 1 ? '-mt-[16vw] sm:mt-0 sm:-ml-[9vw]' : ''
              } sm:w-[36vw] ${booting && !busy ? 'opacity-40' : ''}`}
            >
              <button
                type="button"
                data-interactive
                disabled={booting}
                onClick={() => choose(c.mode)}
                aria-label={`${c.label}. ${c.note}${c.adult ? '. Over 18 only' : ''}.`}
                className="peer group absolute inset-0 block transition-transform duration-700 ease-silk focus-visible:outline focus-visible:outline-1 focus-visible:outline-void/60 disabled:cursor-wait"
                style={{ clipPath: RHOMBUS }}
              >
                {/*
                 * Monochrome until it is wanted. The stills are colour files
                 * and the grey is CSS, so hovering lifts it off rather than
                 * swapping to a second image — one file, and the change is a
                 * transition rather than a load.
                 */}
                <span
                  className="absolute inset-0 bg-cover bg-center mix-blend-multiply transition-all duration-700 ease-silk [filter:grayscale(1)_brightness(0.92)] group-hover:[filter:grayscale(0)_brightness(1.18)] group-focus-visible:[filter:grayscale(0)_brightness(1.18)]"
                  style={{ backgroundImage: `url(${poster(c.mode, c.poster)})` }}
                />
                {/*
                 * The hairline that says this is a thing you can press. A
                 * border cannot draw this edge — `clip-path` cuts the border
                 * box along with everything else, so the two diagonals would
                 * simply be shaved off. The outline is the shape itself,
                 * stroked, with the stroke held at a hairline whatever the
                 * window does to the box.
                 */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full text-void/0 transition-colors duration-700 ease-silk group-hover:text-void/35 group-focus-visible:text-void/35"
                >
                  <polygon
                    points="50,0 100,50 50,100 0,50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </button>
              {/*
               * The label hangs outside its shape — above the first, below the
               * second — so it reads against the flat ground rather than
               * against whatever happens to be in the picture, where it was
               * barely there. Hung rather than stacked, so both shapes stay on
               * the same line as each other.
               */}
              <Label busy={busy} choice={c} above={i === 0} />
            </div>
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
