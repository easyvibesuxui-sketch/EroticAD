import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import vertexShader from '../shaders/steam.vert.glsl?raw'
import fragmentShader from '../shaders/steam.frag.glsl?raw'
import { breath, clamp01, heartbeat, bpmFor } from '../lib/pulse.js'
import { SCRUB_SECONDS, SECTIONS } from '../lib/sections.js'

/** How long a mark's gold bloom lives after the action commits. */
const SPARK_SECONDS = 0.9

/**
 * The film, and the machine that runs it.
 *
 * One fixed plane behind ten scrolling sections. Every frame it asks where the
 * page is, decides whether this section is playing itself or waiting for a
 * hand, and puts the right frame on screen:
 *
 *   entering  seek to the section's first frame and play
 *   playing   run until the sixth second, then stop dead
 *   armed     the playhead belongs to the hand — position it from the drag
 *
 * The last two seconds are never played, in either mode. They are addressed.
 */
export default function FilmPlane({
  playhead,
  standIn,
  texture,
  activeRef,
  progressRef,
  aspectRef,
  sparkRef,
  audioRef,
  signalsRef,
  onPhaseChange,
  reducedMotion = false,
}) {
  const materialRef = useRef()
  const phaseRef = useRef('idle')
  const sectionRef = useRef(-1)
  const beatRef = useRef(0)
  const steamRef = useRef(1)
  const sparkStateRef = useRef({ amount: 0, at: 0 })

  const { size, viewport } = useThree()

  const uniforms = useMemo(
    () => ({
      uTex: { value: texture },
      uCoverScale: { value: new THREE.Vector2(1, 1) },
      uPlaneAspect: { value: 16 / 9 },
      uTime: { value: 0 },
      uSteam: { value: 1 },
      uReveal: { value: 0 },
      uPulse: { value: 0 },
      uBreath: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uWipe: { value: 0 },
      uScrub: { value: 0 },
      uSpark: { value: 0 },
      uSparkPos: { value: new THREE.Vector2(0.5, 0.5) },
    }),
    [texture],
  )

  const setPhase = (next) => {
    if (phaseRef.current === next) return
    phaseRef.current = next
    onPhaseChange?.(next)
  }

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 10)
    const t = state.clock.elapsedTime
    const material = materialRef.current
    if (!material) return
    const u = material.uniforms

    // The last stop on the page is the shop, which has no footage of its own —
    // it holds on the tenth section rather than falling back to the first.
    const section = SECTIONS[Math.min(activeRef.current, SECTIONS.length - 1)]
    const progress = progressRef.current

    // --- the transport ----------------------------------------------------
    if (section.index !== sectionRef.current) {
      sectionRef.current = section.index
      playhead.seek(section.start, 0)
      playhead.play()
      setPhase('playing')
    }

    playhead.tick()

    if (phaseRef.current === 'playing') {
      // Frame-accurate, which `timeupdate` is not — it fires four times a
      // second and would overshoot the hold by up to a fifth of a second.
      if (playhead.time >= section.autoplayEnd - 0.03) {
        playhead.pause()
        playhead.seek(section.autoplayEnd, 0)
        setPhase('armed')
      }
    }

    if (phaseRef.current === 'armed') {
      playhead.seek(section.autoplayEnd + progress * SCRUB_SECONDS)
    }

    // --- geometry ---------------------------------------------------------
    const planeAspect = size.width / Math.max(size.height, 1)
    const texAspect = playhead.video?.videoWidth
      ? playhead.video.videoWidth / playhead.video.videoHeight
      : standIn
        ? standIn.canvas.width / standIn.canvas.height
        : 16 / 9
    aspectRef.current = texAspect

    const cover = u.uCoverScale.value
    if (planeAspect > texAspect) cover.set(1, texAspect / planeAspect)
    else cover.set(planeAspect / texAspect, 1)

    // The mark is where the hand is, so that is where the haze thins first.
    u.uPointer.value.set(
      (section.u - 0.5) / cover.x + 0.5,
      (1 - section.v - 0.5) / cover.y + 0.5,
    )
    u.uWipe.value = progress

    if (standIn) {
      standIn.draw(playhead.time)
      texture.needsUpdate = true
    }

    // --- atmosphere -------------------------------------------------------
    beatRef.current += (dt * bpmFor(progress)) / 60
    const pulse = heartbeat(beatRef.current)
    const br = breath(t)

    const amp = reducedMotion ? 0.3 : 1
    const wobble = 1 + amp * (0.11 * pulse + 0.05 * Math.sin(t * 0.73))
    // Each action clears its own section: the haze is a held breath, and the
    // hand lets it out.
    const targetSteam = clamp01(section.steam * (1 - 0.92 * progress) * wobble)
    steamRef.current += (targetSteam - steamRef.current) * Math.min(1, dt * 7)

    // --- a mark committing ------------------------------------------------
    const spark = sparkRef.current
    if (spark && spark.at !== sparkStateRef.current.at) {
      sparkStateRef.current = { amount: 1, at: spark.at }
      u.uSparkPos.value.set(
        (spark.u - 0.5) / cover.x + 0.5,
        (1 - spark.v - 0.5) / cover.y + 0.5,
      )
    }
    sparkStateRef.current.amount = Math.max(0, sparkStateRef.current.amount - dt / SPARK_SECONDS)

    // --- uniforms ---------------------------------------------------------
    u.uPlaneAspect.value = planeAspect
    u.uTime.value = t
    u.uSteam.value = steamRef.current
    u.uReveal.value = progress
    u.uPulse.value = pulse
    u.uBreath.value = br
    // Winding the film by hand smears it exactly as a shuttle would, because
    // that is what it is: signed, so the trail sits behind the direction of
    // travel whichever way the action is being turned.
    const prev = signalsRef.current.progress ?? progress
    const speed = dt > 0 ? (progress - prev) / dt : 0
    u.uScrub.value = Math.max(-1, Math.min(1, speed * 0.9))
    u.uSpark.value = sparkStateRef.current.amount

    audioRef.current?.update(progress, dt, br, u.uScrub.value)

    signalsRef.current.progress = progress
    signalsRef.current.phase = phaseRef.current
    signalsRef.current.section = section.index
    signalsRef.current.time = playhead.time
  })

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
