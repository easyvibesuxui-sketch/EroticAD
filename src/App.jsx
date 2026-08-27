import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import AgeGate from './components/AgeGate.jsx'
import FilmStage from './components/FilmStage.jsx'
import ScrollTrack from './components/ScrollTrack.jsx'
import SectionIndicator from './components/SectionIndicator.jsx'
import SectionRail from './components/SectionRail.jsx'
import ScrollCue from './components/ScrollCue.jsx'
import SoundToggle from './components/SoundToggle.jsx'
import { AudioEngine } from './lib/AudioEngine.js'
import { MEDIA } from './lib/media.js'
import { Playhead } from './lib/Playhead.js'
import { SECTIONS } from './lib/sections.js'
import { loadAudio, loadVideo } from './lib/loadMedia.js'
import { createStandIn } from './lib/standin.js'
import { useDirectionalDrag } from './hooks/useDirectionalDrag.js'
import { useReducedMotion } from './hooks/useReducedMotion.js'
import { useSectionNavigation } from './hooks/useSectionNavigation.js'

export default function App() {
  const [phase, setPhase] = useState('gate') // gate -> booting -> live
  const [source, setSource] = useState(null) // { playhead, standIn, texture }
  const [transport, setTransport] = useState('idle') // idle | playing | armed
  const [committedIds, setCommittedIds] = useState(() => new Set())
  const [muted, setMuted] = useState(false)

  const audioRef = useRef(null)
  const aspectRef = useRef(16 / 9)
  const sparkRef = useRef({ u: 0.5, v: 0.5, at: 0 })
  const signalsRef = useRef({ progress: 0, phase: 'idle', section: 0, time: 0 })

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

  const toggleSound = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      audioRef.current?.setMuted(next)
      return next
    })
  }, [])

  const handleCommit = useCallback(() => {
    sparkRef.current = { u: section.u, v: section.v, at: performance.now() }
    audioRef.current?.chime()
    if (navigator.vibrate) navigator.vibrate(18)
    setCommittedIds((prev) => {
      if (prev.has(section.id)) return prev
      const next = new Set(prev)
      next.add(section.id)
      return next
    })
  }, [section])

  const drag = useDirectionalDrag({
    dir: section.dir,
    length: section.length,
    enabled: transport === 'armed',
    onCommit: handleCommit,
  })

  // A new section is a new action: whatever was wound on the last one goes
  // back to zero, or the next mark would open already half-used. The transport
  // is disarmed here rather than waiting for the render loop to notice — for
  // the frame in between, the old section's mark would still be live over the
  // new section's footage.
  const { reset } = drag
  useEffect(() => {
    reset()
    setTransport('playing')
  }, [active, reset])

  const handleEnter = useCallback(async () => {
    if (phase !== 'gate') return

    // The context must be opened inside the click itself, before any await.
    const engine = new AudioEngine()
    engine.prime()
    audioRef.current = engine

    setPhase('booting')

    const [video, music, breathTrack] = await Promise.all([
      loadVideo(MEDIA.video),
      loadAudio(MEDIA.music),
      loadAudio(MEDIA.breath),
    ])

    // No footage? Run the whole architecture against a virtual playhead and
    // the procedural stand-in, rather than showing a dead screen.
    const standIn = video ? null : createStandIn()
    const playhead = new Playhead(video)
    const texture = video ? new THREE.VideoTexture(video) : new THREE.CanvasTexture(standIn.canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.colorSpace = THREE.SRGBColorSpace

    setSource({ playhead, standIn, texture })

    const breath =
      breathTrack && music && breathTrack.currentSrc === music.currentSrc ? null : breathTrack
    await engine.start({ musicEl: music, breathEl: breath })
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

  useEffect(() => () => audioRef.current?.dispose(), [])

  const stage = useMemo(() => {
    if (!source) return null
    return (
      <FilmStage
        playhead={source.playhead}
        standIn={source.standIn}
        texture={source.texture}
        activeRef={indexRef}
        progressRef={drag.progressRef}
        aspectRef={aspectRef}
        sparkRef={sparkRef}
        audioRef={audioRef}
        signalsRef={signalsRef}
        onPhaseChange={setTransport}
        reducedMotion={reducedMotion}
      />
    )
  }, [source, indexRef, drag.progressRef, reducedMotion])

  const live = phase === 'live'

  return (
    <main className="relative w-full bg-void" data-phase={phase} data-transport={transport} data-section={active}>
      {stage}

      {live && (
        <>
          <div className="pointer-events-none fixed inset-0 z-20 vignette" />
          <div className="pointer-events-none fixed inset-0 z-20 grain opacity-[0.09]" />

          <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
            <span className="font-sans text-[0.6rem] font-light uppercase tracking-widest3 text-blush/70">
              Eroticad
            </span>
            <span className="flex items-center gap-4">
              <span className="font-sans text-[0.6rem] font-light uppercase tracking-widest2 text-crimson-400/70">
                18+
              </span>
              <SoundToggle muted={muted} onToggle={toggleSound} />
            </span>
          </header>

          <SectionIndicator
            section={section}
            aspectRef={aspectRef}
            armed={transport === 'armed'}
            progressRef={drag.progressRef}
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
