import { useEffect, useRef } from 'react'

import Mark from './Mark.jsx'
import { DIRECTIONS, filmToScreen } from '../lib/layout.js'

/**
 * The mark for the section the page is on, placed on the film and wired to the
 * hand.
 *
 * The hit surface is a band around the ring's travel, not the whole screen. It
 * has to be: the gesture is a drag, and on a phone a drag is also a scroll —
 * so the only region that may claim the touch is the one the mark occupies.
 * Everywhere else the page still scrolls, which is how you leave a section.
 */
export default function SectionIndicator({
  section,
  aspectRef,
  armed,
  progressRef,
  dragging,
  committed,
  handlers,
}) {
  const markRef = useRef(null)
  const hitRef = useRef(null)
  const copyRef = useRef(null)
  const presenceRef = useRef(0)

  const [dx, dy] = DIRECTIONS[section.dir] ?? DIRECTIONS.right
  const along = section.length + 130
  const across = 150
  const horizontal = Math.abs(dx) > 0

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 1 / 8)
      last = now

      const target = armed ? 1 : 0
      presenceRef.current += (target - presenceRef.current) * (1 - Math.exp(-dt / 0.22))
      const presence = presenceRef.current
      const progress = progressRef.current

      const p = filmToScreen(
        section.u,
        section.v,
        window.innerWidth,
        window.innerHeight,
        aspectRef.current || 16 / 9,
      )

      const mark = markRef.current
      if (mark) {
        mark.place(p.x, p.y)
        mark.paint(presence, progress, dragging)
      }
      if (hitRef.current) {
        hitRef.current.style.left = `${p.x}px`
        hitRef.current.style.top = `${p.y}px`
        hitRef.current.style.pointerEvents = presence > 0.6 ? 'auto' : 'none'
        hitRef.current.style.opacity = String(presence)
      }
      if (copyRef.current) {
        // The instruction retires as the action is performed — by then the
        // film is saying it better.
        copyRef.current.style.opacity = String(presence * Math.max(0, 1 - progress * 1.6))
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [aspectRef, armed, dragging, progressRef, section])

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <Mark ref={markRef} dir={section.dir} length={section.length} />

      <div
        ref={hitRef}
        {...handlers}
        role="button"
        data-claims-touch={armed && !committed}
        tabIndex={armed ? 0 : -1}
        aria-label={`${section.actionLabel}. Drag ${section.dir}, or press space.`}
        aria-pressed={committed}
        className="absolute cursor-grab rounded-full focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-8 focus-visible:outline-gold-400 active:cursor-grabbing"
        style={{
          width: horizontal ? along : across,
          height: horizontal ? across : along,
          transform: `translate(-50%, -50%) translate(${(dx * section.length) / 2}px, ${
            (dy * section.length) / 2
          }px)`,
          /*
           * Only ever claim the axis the action actually needs.
           *
           * While the action is outstanding the mark owns the gesture
           * outright — the section is driven, not scrolled, so there is no
           * native panning to preserve. The moment the action is done the
           * surface hands the touch back: the next thing anyone wants to do is
           * scroll on, and a spent control has no business swallowing that.
           */
          touchAction: committed ? 'auto' : 'none',
          opacity: 0,
        }}
      >
        <span
          ref={copyRef}
          className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap pt-4 font-sans text-[0.58rem] font-light uppercase tracking-widest2 text-gold-300/90"
        >
          {section.actionLabel}
        </span>
      </div>
    </div>
  )
}
