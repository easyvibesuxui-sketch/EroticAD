import { useEffect, useRef } from 'react'

import Mark from './Mark.jsx'
import RingMark from './RingMark.jsx'
import { DIRECTIONS, filmToScreen } from '../lib/layout.js'

/**
 * The mark for the action the page is on, placed on the film and wired to the
 * hand.
 *
 * Two shapes, one job. A straight pull gets the straight mark; an action that
 * turns about a point gets the ring. Which one a step uses is the step's own
 * business — everything here is the same either way: place it where the film
 * says, hand it the pointer, and hand the touch back the moment it is spent.
 *
 * The hit surface is a band around the mark, not the whole screen. It has to
 * be: the gesture is a drag, and on a phone a drag is also a scroll — so the
 * only region that may claim the touch is the one the mark occupies. Everywhere
 * else the page still scrolls, which is how you leave a section.
 */
export default function SectionIndicator({
  step,
  travel,
  radius,
  centreRef,
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

  const ring = step.track === 'ring'
  const [dx, dy] = DIRECTIONS[step.dir] ?? DIRECTIONS.right
  const along = travel + 130
  const across = 150
  const horizontal = Math.abs(dx) > 0

  // The ring is grabbed anywhere on its own annulus, so its hit box is a square
  // that contains the whole circle rather than a band along one axis.
  const box = ring ? (radius + 70) * 2 : 0

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
        step.u,
        step.v,
        window.innerWidth,
        window.innerHeight,
        aspectRef.current || 16 / 9,
      )

      /*
       * A circle needs room on every side, and a portrait phone crops a 16:9
       * frame so hard that a point at u 0.4 lands 45px from the left edge —
       * most of the ring off-screen and no way to turn it. So the centre is
       * pushed back inside the viewport, the same bargain the straight mark
       * makes when it clamps its travel: the guide drifts off the exact spot on
       * the body rather than becoming unusable. On any screen with room for it,
       * this changes nothing.
       */
      if (ring) {
        const m = radius + 26
        p.x = Math.min(Math.max(p.x, m), window.innerWidth - m)
        p.y = Math.min(Math.max(p.y, m), window.innerHeight - m)
      }

      // The angular drag measures from the centre of the circle, which is this
      // point — published every frame so it survives a resize with no listener.
      if (centreRef) centreRef.current = p

      const mark = markRef.current
      if (mark) {
        mark.place(p.x, p.y)
        mark.paint(presence, progress, dragging)
      }
      if (hitRef.current) {
        hitRef.current.style.left = `${p.x}px`
        hitRef.current.style.top = `${p.y}px`
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
  }, [aspectRef, armed, centreRef, dragging, progressRef, radius, ring, step])

  const live = armed && !committed

  return (
    <>
      {/*
       * With a mouse, the whole frame is the handle.
       *
       * Hunting for a band of pixels before anything responds is the wrong
       * feeling for a site that is entirely one gesture — the mark says which
       * way and how far, and the hand can start anywhere. Touch is excluded on
       * purpose: there a drag is also a scroll, and only the mark's own region
       * may take it, or there is no way left to leave the section.
       *
       * It sits below the header and the product card, so the sound switch and
       * the buttons stay reachable while a section is armed.
       */}
      <div
        className="fixed inset-0 z-[15]"
        style={{ pointerEvents: live ? 'auto' : 'none', touchAction: 'auto', cursor: 'grab' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return
          handlers.onPointerDown(e)
        }}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
      />

      <div className="pointer-events-none fixed inset-0 z-30">
        {ring ? (
          <RingMark
            ref={markRef}
            radius={radius}
            sweep={step.sweep}
            start={step.start}
            spin={step.spin}
          />
        ) : (
          <Mark ref={markRef} dir={step.dir} length={travel} />
        )}

        <div
          ref={hitRef}
          {...handlers}
          role="button"
          data-claims-touch={armed && !committed}
          tabIndex={armed ? 0 : -1}
          aria-label={
            ring
              ? `${step.label}. Turn ${step.spin > 0 ? 'clockwise' : 'anticlockwise'}, or press space.`
              : `${step.label}. Drag ${step.dir}, or press space.`
          }
          aria-pressed={committed}
          className="absolute cursor-grab rounded-full focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-8 focus-visible:outline-gold-400 active:cursor-grabbing"
          style={{
            width: ring ? box : horizontal ? along : across,
            height: ring ? box : horizontal ? across : along,
            transform: ring
              ? 'translate(-50%, -50%)'
              : `translate(-50%, -50%) translate(${(dx * travel) / 2}px, ${(dy * travel) / 2}px)`,
            /*
             * On touch, only ever claim the axis the action actually needs.
             * While the action is outstanding the mark owns the gesture
             * outright — the section is driven, not scrolled, so there is no
             * native panning to preserve. The moment the action is done the
             * surface hands the touch back: the next thing anyone wants to do
             * is scroll on, and a spent control has no business swallowing it.
             */
            touchAction: committed ? 'auto' : 'none',
            /*
             * Grabbable the instant the section arms, not once a fade finishes.
             * This used to follow the eased presence, which is driven by
             * requestAnimationFrame — on a device where frames are scarce the
             * mark would be plainly visible and still refuse the hand.
             */
            pointerEvents: armed ? 'auto' : 'none',
            opacity: 0,
          }}
        >
          <span
            ref={copyRef}
            className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap pt-4 font-sans text-[0.58rem] font-light uppercase tracking-widest2 text-gold-300/90"
          >
            {step.label}
          </span>
        </div>
      </div>
    </>
  )
}
