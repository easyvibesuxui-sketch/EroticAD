import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import AgeGate from './components/AgeGate.jsx'
import FilmStage from './components/FilmStage.jsx'
import ScrollTrack from './components/ScrollTrack.jsx'
import SectionIndicator from './components/SectionIndicator.jsx'
import SectionRail from './components/SectionRail.jsx'
import ScrollCue from './components/ScrollCue.jsx'
import SoundToggle from './components/SoundToggle.jsx'
import Wordmark from './components/Wordmark.jsx'
import { AudioEngine } from './lib/AudioEngine.js'
import { MEDIA } from './lib/media.js'
import { Playhead } from './lib/Playhead.js'
import { createFilmSources } from './lib/filmSources.js'
import { SECTIONS } from './lib/sections.js'
import { loadAudio, loadVideo } from './lib/loadMedia.js'
import { createPrefetcher } from './lib/prefetch.js'
import { createStandIn } from './lib/standin.js'
import { useAngularDrag } from './hooks/useAngularDrag.js'
import { useDirectionalDrag } from './hooks/useDirectionalDrag.js'
import { usePathDrag } from './hooks/usePathDrag.js'
import { useReducedMotion } from './hooks/useReducedMotion.js'
import { useMarkTravel } from './hooks/useMarkTravel.js'
import { useRingRadius } from './hooks/useRingRadius.js'
import { useZigzagPath } from './hooks/useZigzagPath.js'
import { useSectionNavigation } from './hooks/useSectionNavigation.js'

export default function App() {
  const [phase, setPhase] = useState('gate') // gate -> booting -> live
  const [source, setSource] = useState(null) // { playhead, sources, standIn }
  const [transport, setTransport] = useState('idle') // idle | playing | armed
  const [committedIds, setCommittedIds] = useState(() => new Set())
  const [muted, setMuted] = useState(false)
  /*
   * Which of this section's actions the hand is on.
   *
   * Almost every section is one clip and stays at 0. Section two is two, and
   * finishing the first hands the film to the second — winding the second back
   * past its own start hands it back again.
   */
  const [step, setStep] = useState(0)

  const audioRef = useRef(null)
  const aspectRef = useRef(16 / 9)
  const sparkRef = useRef({ u: 0.5, v: 0.5, at: 0 })
  const signalsRef = useRef({ progress: 0, phase: 'idle', section: 0, time: 0 })
  const stepRef = useRef(0)
  /*
   * One progress ref for the whole page. Whichever control this step calls for
   * writes into it, so the render loop never has to know which shape won — and
   * the film stage is never rebuilt just because the guide changed.
   */
  const progressRef = useRef(0)
  const centreRef = useRef({ x: 0, y: 0 })
  const prefetchRef = useRef(null)
  /** Where the next step opens: 0 coming forward, 1 coming back. */
  const enterAtRef = useRef(0)

  const reducedMotion = useReducedMotion()
  const trackRef = useRef(null)

  // One more stop than there are sections: the last screen is the shop.
  const { index, indexRef } = useSectionNavigation({
    count: SECTIONS.length + 1,
    enabled: phase === 'live',
    trackRef,
  })

  const active = Math.min(index, SECTIONS.length - 1)
  const section = SECTIONS[active]
  const stepIndex = Math.min(step, section.steps.length - 1)
  const action = section.steps[stepIndex]
  const isLastStep = stepIndex === section.steps.length - 1
  const ring = action.track === 'ring'
  const route = action.track === 'zigzag'

  const toggleSound = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      audioRef.current?.setMuted(next)
      return next
    })
  }, [])

  const handleCommit = useCallback(() => {
    sparkRef.current = { u: action.u, v: action.v, at: performance.now() }
    audioRef.current?.chime()
    if (navigator.vibrate) navigator.vibrate(18)
    // A section is done when its *last* action is done. Until then the piece is
    // still coming off, and the card has nothing to announce yet.
    if (!isLastStep) return
    audioRef.current?.after()
    setCommittedIds((prev) => {
      if (prev.has(section.id)) return prev
      const next = new Set(prev)
      next.add(section.id)
      return next
    })
  }, [action, isLastStep, section.id])

  // Drag the piece back on and the sound goes with it. The rail keeps its
  // gold — that is a record of what you did, not a description of the frame —
  // but nothing is left playing over a section that has been put back.
  const handleUndo = useCallback(() => {
    audioRef.current?.stopAfter()
  }, [])

  /** Wound all the way: the next clip takes the film, opened at its start. */
  const handleFull = useCallback(() => {
    if (isLastStep) return
    /*
     * Never cut to a clip that has not buffered its first frames. The film
     * would fall back to the approach's last frame for as long as it took to
     * arrive, which reads as the picture jumping backwards under the hand. The
     * hand simply stays at the end of this clip until the next one is there —
     * and `onFull` fires on every move once it is wound, so the handover
     * happens the moment it can.
     */
    if (!source?.sources.ready(active, `step:${stepIndex + 1}`)) return
    enterAtRef.current = 0
    setStep((n) => n + 1)
  }, [active, isLastStep, source, stepIndex])

  /**
   * Wound back past the start: the previous clip takes the film again, fully
   * wound, so the hand carries on backwards through the whole action instead of
   * hitting a wall at a cut it never saw.
   */
  const handleExitBack = useCallback(() => {
    if (stepIndex === 0) return
    audioRef.current?.stopAfter()
    enterAtRef.current = 1
    setStep((n) => Math.max(0, n - 1))
  }, [stepIndex])

  const travel = useMarkTravel(action, aspectRef)
  const radius = useRingRadius(action)
  const path = useZigzagPath(action)

  /*
   * Both controls exist; only the one this step calls for is enabled, and only
   * an enabled one writes to the progress ref or runs a frame loop. Hooks
   * cannot be called conditionally, and the alternative — one hook that is
   * secretly two — would put the straight pull and the turn in the same
   * function for nothing.
   */
  const linear = useDirectionalDrag({
    dir: action.dir,
    length: travel,
    enabled: transport === 'armed' && !ring && !route,
    progressRef,
    onCommit: handleCommit,
    onUndo: handleUndo,
    onFull: handleFull,
  })

  const angular = useAngularDrag({
    step: action,
    centreRef,
    radius,
    enabled: transport === 'armed' && ring,
    progressRef,
    onCommit: handleCommit,
    onUndo: handleUndo,
    onFull: handleFull,
    onExitBack: handleExitBack,
  })

  const along = usePathDrag({
    path,
    originRef: centreRef,
    enabled: transport === 'armed' && route,
    progressRef,
    onCommit: handleCommit,
    onUndo: handleUndo,
    onFull: handleFull,
  })

  const drag = ring ? angular : route ? along : linear

  // A new section is a new action: whatever was wound on the last one goes
  // back to zero, or the next mark would open already half-used. The transport
  // is disarmed here rather than waiting for the render loop to notice — for
  // the frame in between, the old section's mark would still be live over the
  // new section's footage.
  const linearReset = linear.reset
  const angularReset = angular.reset
  const alongReset = along.reset
  useEffect(() => {
    enterAtRef.current = 0
    setStep(0)
    stepRef.current = 0
    linearReset()
    angularReset(0)
    alongReset()
    audioRef.current?.stopAfter()
    setTransport('playing')
  }, [active, alongReset, angularReset, linearReset])

  /*
   * Handing over between the clips inside a section. The film needs no seek:
   * the two clips meet on the same picture — 0.36 of a grey level apart out of
   * 255 — so this only has to put the control where the hand left it.
   */
  useEffect(() => {
    stepRef.current = stepIndex
    const at = enterAtRef.current
    progressRef.current = at
    if (ring) angularReset(at)
    else if (route) alongReset()
    else linearReset()
  }, [alongReset, angularReset, linearReset, ring, route, stepIndex])

  const handleEnter = useCallback(async () => {
    if (phase !== 'gate') return

    // The context must be opened inside the click itself, before any await.
    const engine = new AudioEngine()
    engine.prime()
    audioRef.current = engine

    setPhase('booting')

    const [video, music, afterTrack] = await Promise.all([
      loadVideo(MEDIA.video),
      loadAudio(MEDIA.music),
      loadAudio(MEDIA.after),
    ])

    // Sections carry their own clips; anything not yet delivered falls back to
    // a shared cut, and failing that to the procedural stand-in, so the whole
    // architecture runs with one file or with none.
    const standIn = video ? null : createStandIn()
    const playhead = new Playhead(null)
    const sources = createFilmSources({ sections: SECTIONS, sharedVideo: video, standIn })
    sources.prepare(0)
    prefetchRef.current = createPrefetcher({ sections: SECTIONS })

    setSource({ playhead, sources, standIn })

    await engine.start({ musicEl: music, afterEl: afterTrack })
    setPhase('live')
  }, [phase])

  // The page does not scroll until the gate is answered.
  useEffect(() => {
    const root = document.documentElement
    const live = phase === 'live'
    root.style.overflowY = live ? 'auto' : 'hidden'
    return () => {
      root.style.overflowY = ''
    }
  }, [phase])

  /*
   * The background queue, and the only two things it is allowed to know: which
   * section the page is on, and whether anything more urgent is happening. The
   * hand on the mark and a section still loading its own clips both count as
   * more urgent — see `prefetch.js`.
   */
  useEffect(() => {
    const idle = transport === 'armed' && !drag.dragging
    prefetchRef.current?.setBusy(!idle)
    if (idle) prefetchRef.current?.want(active)
  }, [active, drag.dragging, transport])

  useEffect(() => () => prefetchRef.current?.dispose(), [])
  useEffect(() => () => audioRef.current?.dispose(), [])
  useEffect(() => () => source?.sources.dispose(), [source])

  const stage = useMemo(() => {
    if (!source) return null
    return (
      <FilmStage
        playhead={source.playhead}
        sources={source.sources}
        standIn={source.standIn}
        activeRef={indexRef}
        stepRef={stepRef}
        progressRef={progressRef}
        aspectRef={aspectRef}
        sparkRef={sparkRef}
        audioRef={audioRef}
        signalsRef={signalsRef}
        onPhaseChange={setTransport}
        reducedMotion={reducedMotion}
      />
    )
  }, [source, indexRef, reducedMotion])

  const live = phase === 'live'

  return (
    <main
      className="relative w-full bg-void"
      data-phase={phase}
      data-transport={transport}
      data-section={active}
      data-step={stepIndex}
    >
      {stage}

      {live && (
        <>
          <div className="pointer-events-none fixed inset-0 z-20 vignette" />
          <div className="pointer-events-none fixed inset-0 z-20 grain opacity-[0.09]" />

          <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
            <Wordmark className="text-blush/80" />
            <span className="flex items-center gap-4">
              <span className="font-sans text-[0.6rem] font-light uppercase tracking-widest2 text-crimson-400/70">
                18+
              </span>
              <SoundToggle muted={muted} onToggle={toggleSound} />
            </span>
          </header>

          <SectionIndicator
            key={`${section.id}:${stepIndex}`}
            step={action}
            travel={travel}
            radius={radius}
            path={path}
            centreRef={centreRef}
            aspectRef={aspectRef}
            armed={transport === 'armed'}
            progressRef={progressRef}
            dragging={drag.dragging}
            committed={drag.committed}
            handlers={drag.handlers}
          />

          <ScrollCue visible={committedIds.has(section.id)} />
          <SectionRail active={active} committedIds={committedIds} />
          <ScrollTrack ref={trackRef} active={active} committedIds={committedIds} />
        </>
      )}

      {!live && <AgeGate onEnter={handleEnter} booting={phase === 'booting'} />}
    </main>
  )
}
