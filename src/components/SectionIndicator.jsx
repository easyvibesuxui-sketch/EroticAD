import { useEffect, useRef } from 'react'

import Mark from './Mark.jsx'
import PathMark from './PathMark.jsx'
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
  path,
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
  const route = step.track === 'zigzag'
  const [dx, dy] = DIRECTIONS[step.dir] ?? DIRECTIONS.right
  const along = travel + 130
  const across = 150
  const horizontal = Math.abs(dx) > 0

  // The ring is grabbed anywhere on its own annulus, so its hit box is a square
  // that contains the whole circle rather than a band along one axis.
  const box = ring ? (radius + 70) * 2 : 0

  /*
   * A route's hit box is the box its own points need, grown by the corridor the
   * hand is allowed to stray into. It is offset rather than centred, because a
   * route starts at the hotspot and goes somewhere from there.
   */
  const routeBox = route
    ? (() => {
        const pad = path.amplitude + 80
        const xs = path.points.map((q) => q.x)
        const ys = path.points.map((q) => q.y)
        const left = Math.min(...xs) - pad
        const top = Math.min(...ys) - pad
        return { left, top, width: Math.max(...xs) + pad - left, height: Math.max(...ys) + pad - top }
      })()
    : null

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
       * Keep the whole guide on screen.
       *
       * A portrait phone crops a 16:9 frame to its middle third, which puts
       * plenty of perfectly good hotspots within a few pixels of an edge — and
       * a control you cannot reach the far end of is not a control. `travel`
       * is already clamped to the room available, but it has a floor beneath
       * which it has no resolution left, so on a narrow screen the floor wins
       * and the dashes run off the frame. The ring has it worse: it needs room
       * on every side at once.
       *
       * So the mark is pushed back inboard until it fits. It drifts off the
       * exact spot on the body, which is the lesser loss. On any screen with
       * room for it, this changes nothing at all.
       */
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (ring) {
        const m = radius + 26
        p.x = Math.min(Math.max(p.x, m), vw - m)
        p.y = Math.min(Math.max(p.y, m), vh - m)
      } else {
        const m = 24
        const endX = p.x + dx * travel
        const endY = p.y + dy * travel
        if (endX > vw - m) p.x -= endX - (vw - m)
        else if (endX < m) p.x += m - endX
        if (endY > vh - m) p.y -= endY - (vh - m)
        else if (endY < m) p.y += m - endY
        // ...and never past the near edge either, which a very short window
        // could otherwise do while fixing the far one.
        p.x = Math.min(Math.max(p.x, m), vw - m)
        p.y = Math.min(Math.max(p.y, m), vh - m)
      }

      // The angular drag measures from the centre of the circle and the path
      // drag from the route's origin. Both are this point, published every
      // frame so they survive a resize with no listener.
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
  }, [aspectRef, armed, centreRef, dragging, dx, dy, progressRef, radius, ring, step, travel])

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
        ) : route ? (
          <PathMark ref={markRef} path={path} />
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
              : route
                ? `${step.label}. Follow the zigzag ${step.dir}, or press space.`
                : `${step.label}. Drag ${step.dir}, or press space.`
          }
          aria-pressed={committed}
          className="absolute cursor-grab rounded-full focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-8 focus-visible:outline-gold-400 active:cursor-grabbing"
          style={{
            width: route ? routeBox.width : ring ? box : horizontal ? along : across,
            height: route ? routeBox.height : ring ? box : horizontal ? across : along,
            transform: route
              ? `translate(${routeBox.left}px, ${routeBox.top}px)`
              : ring
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
            style={{ textShadow: '0 1px 2px rgba(4,2,3,0.9), 0 2px 12px rgba(4,2,3,0.8)' }}
          >
            {step.label}
          </span>
        </div>
      </div>
    </>
  )
}
