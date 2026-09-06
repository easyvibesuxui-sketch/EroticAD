import { useState } from 'react'

import Wordmark from './Wordmark.jsx'
import { BRAND, Spell } from '../lib/brand.js'
import { SECTIONS } from '../lib/sections.js'

/**
 * The last screen, and the only one that behaves like an ordinary shop.
 *
 * It is one screen tall on purpose. The page is driven a section at a time —
 * the wheel is taken and every move is exactly one viewport — so anything past
 * the last stop cannot be reached and anything taller than a viewport cannot be
 * scrolled within. The closing line, the way to buy, the newsletter and the
 * small print therefore share one screen rather than sitting below it.
 *
 * The film is still running behind the whole page, so this ends it: an opaque
 * ground with a gradient lip at the top, which is where the picture stops and
 * the shop begins.
 */

const YEAR = new Date().getFullYear()

const COLUMNS = [
  {
    title: 'The collection',
    links: [
      ['Every piece', '#collection'],
      ['Made to order', '#made-to-order'],
      ['Size and fit', '#fit'],
    ],
  },
  {
    title: 'The house',
    links: [
      ['The atelier', '#atelier'],
      ['Care', '#care'],
      ['Shipping and returns', '#shipping'],
    ],
  },
]

/**
 * The subscribe field.
 *
 * With an endpoint configured it is an ordinary POST. Without one it opens the
 * visitor's mail client addressed to the house — which is not elegant, but is
 * the only honest thing a form with nowhere to send can do. A box that takes an
 * address, says thank you and drops it is worse than no box.
 */
function Subscribe() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | done | error

  const submit = async (e) => {
    e.preventDefault()
    if (!email.includes('@') || state === 'sending') return

    if (!BRAND.newsletter) {
      window.location.href = `mailto:${BRAND.email}?subject=${encodeURIComponent(
        `Subscribe — ${BRAND.season}`,
      )}&body=${encodeURIComponent(`Please add ${email} to the list.`)}`
      setState('done')
      return
    }

    setState('sending')
    try {
      const res = await fetch(BRAND.newsletter, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p className="font-serif text-lg font-light italic text-blush/80">
        You are on the list. Nothing until there is something.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <label
        htmlFor="subscribe"
        className="block font-sans text-[0.55rem] font-light uppercase tracking-widest3 text-gold-400/80"
      >
        First to know
      </label>
      <div className="mt-3 flex items-end gap-4 border-b border-blush/25 pb-2 transition-colors duration-500 ease-silk focus-within:border-gold-300/70">
        <input
          id="subscribe"
          type="email"
          required
          data-interactive
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (state === 'error') setState('idle')
          }}
          placeholder="your email"
          autoComplete="email"
          className="min-w-0 flex-1 bg-transparent font-serif text-lg font-light text-blush placeholder:text-blush/30 focus:outline-none"
        />
        <button
          type="submit"
          data-interactive
          disabled={state === 'sending'}
          className="shrink-0 font-sans text-[0.62rem] font-light uppercase tracking-widest2 text-gold-300/90 transition-colors duration-500 ease-silk hover:text-blush focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-gold-400 disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending' : 'Subscribe'}
        </button>
      </div>
      <p className="mt-1.5 h-3.5 font-sans text-[0.56rem] font-light tracking-widest2 text-crimson-200/70">
        {state === 'error' ? 'That did not send. Try again in a moment.' : ''}
      </p>
    </form>
  )
}

export default function Footer({ style }) {
  return (
    <footer
      data-scrolls
      className="pointer-events-auto relative flex h-screen flex-col justify-between overflow-y-auto bg-void px-6 pb-7 pt-12 sm:px-12 sm:pb-10 sm:pt-16"
      style={style}
    >
      {/* where the film stops and the shop starts */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent to-void" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-7 sm:gap-10">
        <div className="max-w-xl">
          <p className="font-sans text-[0.55rem] font-light uppercase tracking-widest3 text-gold-400/80">
            {BRAND.season}
          </p>
          <h2 className="mt-4 text-balance font-serif text-3xl font-light italic leading-tight text-blush sm:text-4xl">
            {Spell(SECTIONS.length)} pieces. You took all of them off.
          </h2>
          <p className="mt-4 max-w-sm font-sans text-[0.62rem] font-light leading-relaxed tracking-[0.16em] text-blush/60">
            Each made to order in a numbered edition. Nothing is restocked.
          </p>
          <a
            href="#collection"
            data-interactive
            className="group relative mt-7 inline-block overflow-hidden border border-blush/30 bg-void/40 px-10 py-3.5 font-sans text-[0.66rem] font-light uppercase tracking-widest2 text-blush transition-all duration-700 ease-silk hover:border-blush/70 hover:bg-crimson-700/30"
          >
            <span className="relative z-10">Shop the collection</span>
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-blush/20 to-transparent" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-7 border-t border-blush/10 pt-6 sm:grid-cols-[1fr_auto_auto] sm:gap-14 sm:pt-9">
          <div className="col-span-2 sm:col-span-1">
            <Subscribe />
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-sans text-[0.55rem] font-light uppercase tracking-widest3 text-gold-400/80">
                {col.title}
              </p>
              <ul className="mt-3 space-y-1.5 sm:space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      data-interactive
                      className="font-sans text-[0.66rem] font-light tracking-[0.14em] text-blush/65 transition-colors duration-500 ease-silk hover:text-blush"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-start gap-3 border-t border-blush/10 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-6">
        <Wordmark className="text-blush/60" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-sans text-[0.56rem] font-light uppercase tracking-widest2 text-smoke/50">
          <a
            href={`mailto:${BRAND.email}`}
            data-interactive
            className="transition-colors duration-500 ease-silk hover:text-blush/80"
          >
            {BRAND.email}
          </a>
          <a href="#terms" data-interactive className="transition-colors duration-500 ease-silk hover:text-blush/80">
            Terms
          </a>
          <a href="#privacy" data-interactive className="transition-colors duration-500 ease-silk hover:text-blush/80">
            Privacy
          </a>
          <span className="text-crimson-400/60">18+</span>
          <span>© {YEAR} {BRAND.house}</span>
        </div>
      </div>
    </footer>
  )
}
