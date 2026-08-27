import { useEffect, useMemo, useRef } from 'react'

import Trace from './Trace.jsx'
import { ARM_RADIUS, DWELL_SECONDS, PULL_THRESHOLD, TRACES } from '../lib/traces.js'
import { DIRECTIONS, filmToScreen } from '../lib/layout.js'

const OPEN_HOLD_MS = 5000
const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Places the marks on the film and drives them.
 *
 * The marks only exist while the glass is clearing, so arming works off the
 * live pointer position rather than off a fresh press — by the time a mark is
 * visible the hand is already down on the glass, and lifting it to "click"
 * would close everything it was there to open.
 */
export default function TraceLayer({
  signalsRef,
  gestureRef,
  aspectRef,
  sparkRef,
  onOpen,
  releaseTrace,
}) {
  const rootRef = useRef(null)
  const marks = useRef(new Map())
  const state = useRef(
    new Map(TRACES.map((t) => [t.id, { progress: 0, armed: 0, openedAt: 0, fired: false }])),
  )
  const lastScreen = useRef({ x: 0, y: 0 })
  const armedIdRef = useRef(null)
  const lastTime = useRef(performance.now())

  // Stable per-mark ref callbacks: a fresh closure each render would detach
  // and reattach every node.
  const setters = useMemo(
    () =>
      Object.fromEntries(
        TRACES.map((trace) => [
          trace.id,
          (node) => {
            if (node) marks.current.set(trace.id, node)
            else marks.current.delete(trace.id)
          },
        ]),
      ),
    [],
  )

  useEffect(() => {
    let raf = 0

    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - lastTime.current) / 1000, 1 / 8)
      lastTime.current = now

      const s = signalsRef.current
      const g = gestureRef.current
      const presence = smoothstep(0.45, 0.86, s.reveal)

      const vw = window.innerWidth
      const vh = window.innerHeight
      const aspect = aspectRef.current || 16 / 9

      let dwelling = false

      // How fast is the hand? A dwell has to be still.
      const moved = Math.hypot(g.screen.x - lastScreen.current.x, g.screen.y - lastScreen.current.y)
      lastScreen.current = { x: g.screen.x, y: g.screen.y }

      const isOpen = (id) => {
        const st = state.current.get(id)
        return st.openedAt > 0 && now - st.openedAt < OPEN_HOLD_MS
      }

      // A pull keeps the hand until it resolves — but an already-open mark
      // never takes it again, or the hand can never leave what it just opened
      // without lifting off the glass.
      let armedId = g.mode === 'trace' ? armedIdRef.current : null
      if (armedId && isOpen(armedId)) {
        armedId = null
        releaseTrace?.()
      }

      let armedDist = Infinity
      if (!armedId && presence > 0.5 && g.holding) {
        for (const trace of TRACES) {
          if (isOpen(trace.id)) continue
          const p = filmToScreen(trace.u, trace.v, vw, vh, aspect)
          const d = Math.hypot(g.screen.x - p.x, g.screen.y - p.y)
          if (d < ARM_RADIUS && d < armedDist) {
            armedDist = d
            armedId = trace.id
          }
        }
      }

      if (armedId) {
        const trace = TRACES.find((t) => t.id === armedId)
        g.armed = {
          id: trace.id,
          kind: trace.kind,
          dir: trace.kind === 'pull' ? DIRECTIONS[trace.dir] : [0, 0],
          length: trace.length ?? 0,
        }
        // A new mark starts its pull from wherever the hand is right now; the
        // gesture hook trails the anchor from there until the pull begins.
        if (armedIdRef.current !== armedId) g.armAnchor = { ...g.screen }
      } else {
        g.armed = null
      }
      armedIdRef.current = armedId

      for (const trace of TRACES) {
        const st = state.current.get(trace.id)
        const node = marks.current.get(trace.id)
        const p = filmToScreen(trace.u, trace.v, vw, vh, aspect)
        const armed = armedId === trace.id

        st.armed += ((armed ? 1 : 0) - st.armed) * Math.min(1, dt * 9)

        const opened = isOpen(trace.id)

        if (opened) {
          st.progress = 1
        } else if (armed && trace.kind === 'pull' && g.mode === 'trace' && g.armed) {
          const dir = DIRECTIONS[trace.dir]
          const adx = g.screen.x - g.armAnchor.x
          const ady = g.screen.y - g.armAnchor.y
          const along = (adx * dir[0] + ady * dir[1]) / trace.length
          st.progress = Math.min(1, Math.max(0, along))
        } else if (armed && trace.kind === 'dwell' && g.holding && moved < 2.5) {
          st.progress = Math.min(1, st.progress + dt / DWELL_SECONDS)
          if (st.progress > 0.12) dwelling = true
        } else {
          st.progress = Math.max(0, st.progress - dt * 2.6)
          if (st.openedAt > 0 && !opened) {
            st.openedAt = 0
            st.fired = false
          }
          // An abandoned pull gives the hand back.
          if (st.progress === 0 && armed && g.mode === 'trace') releaseTrace?.()
        }

        const threshold = trace.kind === 'pull' ? PULL_THRESHOLD : 1
        if (!st.fired && st.progress >= threshold) {
          st.fired = true
          st.openedAt = now
          sparkRef.current = { u: trace.u, v: trace.v, at: now }
          if (navigator.vibrate) navigator.vibrate(18)
          onOpen?.(trace)

          // The mark is open; the hand is free to go elsewhere without
          // lifting. Everything the gesture hook reads is cleared here, in the
          // same frame — publishing it on the next one would leave a window
          // where the hand is still held by a mark that has already resolved,
          // and on a slow device that window is long enough to swallow the
          // next gesture.
          g.armed = null
          armedIdRef.current = null
          dwelling = false
          releaseTrace?.()
        }

        if (node) {
          node.place(p.x, p.y)
          node.paint(presence, st.armed, st.progress, opened)
        }
      }

      g.dwelling = dwelling

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [aspectRef, gestureRef, onOpen, releaseTrace, signalsRef, sparkRef])

  return (
    <div ref={rootRef} className="pointer-events-none fixed inset-0 z-20">
      {TRACES.map((trace) => (
        <Trace key={trace.id} trace={trace} ref={setters[trace.id]} />
      ))}
    </div>
  )
}
