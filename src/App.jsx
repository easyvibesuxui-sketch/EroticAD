import { useCallback, useEffect, useRef, useState } from 'react'

import AgeGate from './components/AgeGate.jsx'
import Overlay from './components/Overlay.jsx'
import Stage from './components/Stage.jsx'
import { AudioEngine } from './lib/AudioEngine.js'
import { MEDIA } from './lib/media.js'
import { loadAudio, loadVideo } from './lib/loadMedia.js'
import { createStandIn } from './lib/standin.js'
import { useHold } from './hooks/useHold.js'
import { useReducedMotion } from './hooks/useReducedMotion.js'

/** How long the glass has to stay clear before the shop reveals itself. */
const CTA_DELAY_MS = 3000

/**
 * Once it has been earned, the call to action outlives the hold. Letting it
 * vanish on release would make it unclickable: you have to let go of the glass
 * to reach for it.
 */
const CTA_GRACE_MS = 6000

export default function App() {
  const [phase, setPhase] = useState('gate') // gate -> booting -> live
  const [videoEl, setVideoEl] = useState(null)
  const [standIn, setStandIn] = useState(null)
  const [ctaVisible, setCtaVisible] = useState(false)

  const audioRef = useRef(null)
  const ctaTimer = useRef(0)
  const ctaVisibleRef = useRef(false)
  const signalsRef = useRef({ reveal: 0, steam: 1, pulse: 0, holding: false })

  const reducedMotion = useReducedMotion()
  const { holdRef, pointerRef } = useHold({ enabled: phase === 'live' })

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

    // No footage anywhere? Run the whole mechanic against the stand-in rather
    // than showing a dead screen.
    setVideoEl(video)
    setStandIn(video ? null : createStandIn())

    // If the breath layer resolved to the same file as the track, it adds
    // nothing — drop it and let the synthesised breath do the work.
    const breath =
      breathTrack && music && breathTrack.currentSrc === music.currentSrc ? null : breathTrack

    await engine.start({ musicEl: music, breathEl: breath })
    setPhase('live')
  }, [phase])

  const showCta = useCallback((visible) => {
    ctaVisibleRef.current = visible
    setCtaVisible(visible)
  }, [])

  const handleClearChange = useCallback(
    (clear) => {
      window.clearTimeout(ctaTimer.current)
      if (clear) {
        ctaTimer.current = window.setTimeout(() => showCta(true), CTA_DELAY_MS)
      } else if (ctaVisibleRef.current) {
        ctaTimer.current = window.setTimeout(() => showCta(false), CTA_GRACE_MS)
      } else {
        showCta(false)
      }
    },
    [showCta],
  )

  useEffect(
    () => () => {
      window.clearTimeout(ctaTimer.current)
      audioRef.current?.dispose()
    },
    [],
  )

  const live = phase === 'live'

  return (
    <main className="relative h-full w-full bg-void">
      {(videoEl || standIn) && (
        <Stage
          videoEl={videoEl}
          standIn={standIn}
          holdRef={holdRef}
          pointerRef={pointerRef}
          audioRef={audioRef}
          signalsRef={signalsRef}
          onClearChange={handleClearChange}
          reducedMotion={reducedMotion}
        />
      )}

      {live && <Overlay signalsRef={signalsRef} ctaVisible={ctaVisible} />}

      {phase !== 'live' && <AgeGate onEnter={handleEnter} booting={phase === 'booting'} />}
    </main>
  )
}
