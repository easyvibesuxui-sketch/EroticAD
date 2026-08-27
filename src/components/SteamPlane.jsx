import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import vertexShader from '../shaders/steam.vert.glsl?raw'
import fragmentShader from '../shaders/steam.frag.glsl?raw'
import { advanceReveal, bpmFor, breath, clamp01, heartbeat, smoothstep01 } from '../lib/pulse.js'

const CLEAR_THRESHOLD = 0.985

/** Film seconds travelled per pixel dragged. 400px ≈ 9 seconds. */
const SECONDS_PER_PX = 0.022

/** Film seconds per second while an arrow key is held. */
const KEY_SCRUB_RATE = 3.2
const KEY_SCRUB_PX = 145

/**
 * Milliseconds of a still hand that end a shuttle. Generous on purpose: a slow,
 * deliberate rewind is mostly pauses, and a shorter fuse makes it stutter in
 * and out of the mode while the hand is still clearly working.
 */
const SCRUB_REST_MS = 450

/** Shuttle speed that reads as "full smear" in the shader. */
const FULL_SHUTTLE = 7

/** How long a gold mark's bloom lives. */
const SPARK_SECONDS = 0.9

// Reused every frame so the loop never allocates.
const tmpPointer = new THREE.Vector2()

/**
 * The pane. Everything that moves — the fog, the pulse, the filter cutoff, the
 * film's own playhead, the CTA timer — is driven from this single frame loop,
 * so the picture, the sound and the interface can never drift out of phase
 * with each other.
 */
export default function SteamPlane({
  videoEl,
  standIn,
  gestureRef,
  audioRef,
  signalsRef,
  aspectRef,
  scrubRef,
  sparkRef,
  endScrub,
  onClearChange,
  reducedMotion = false,
}) {
  const materialRef = useRef()
  const revealRef = useRef(0)
  const wipeRef = useRef(0)
  const beatRef = useRef(0)
  const wasClearRef = useRef(false)
  const smoothPointer = useRef(new THREE.Vector2(0.5, 0.5))

  const shuttleRef = useRef(0)
  const wasScrubbingRef = useRef(false)
  const standInOffsetRef = useRef(0)
  const sparkRef2 = useRef({ amount: 0, at: 0 })

  const { size, viewport } = useThree()

  const texture = useMemo(() => {
    const tex = videoEl
      ? new THREE.VideoTexture(videoEl)
      : new THREE.CanvasTexture(standIn.canvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [videoEl, standIn])

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

  useEffect(() => {
    if (!videoEl) return undefined
    const play = () => videoEl.play().catch(() => {})
    play()
    // Some browsers pause a backgrounded video and never resume it on return.
    const onVisible = () => document.visibilityState === 'visible' && play()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [videoEl])

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((state, rawDelta) => {
    // A tab that was backgrounded returns with a delta measured in seconds;
    // clamping stops the reveal from snapping wide open on the first frame
    // back. The ceiling is deliberately loose — clamping tighter would slow
    // every timed gesture down on a slow device, where a hold that takes
    // twice as long is a worse bug than a single fast frame.
    const dt = Math.min(rawDelta, 1 / 10)
    const t = state.clock.elapsedTime
    const material = materialRef.current
    if (!material) return
    const u = material.uniforms
    const g = gestureRef.current

    // --- the film's own playhead ------------------------------------------
    const scrubbing = g.mode === 'scrub'
    let deltaSeconds = 0

    if (scrubbing !== wasScrubbingRef.current) {
      wasScrubbingRef.current = scrubbing
      if (scrubbing) {
        // Each shuttle starts from zero. The readout is deliberately *not*
        // cleared when one ends — it would blink back to nothing while the
        // rail is still fading out.
        scrubRef.current.seconds = 0
        scrubRef.current.pixels = 0
        // Drop the travel banked at engagement, so the film does not lurch.
        g.scrubPending = 0
      }
      // Seeking a playing element fights itself; hand the playhead over
      // completely for the duration of the shuttle.
      if (videoEl) {
        if (scrubbing) videoEl.pause()
        else videoEl.play().catch(() => {})
      }
    }

    if (scrubbing) {
      if (g.keyDir) {
        deltaSeconds = g.keyDir * KEY_SCRUB_RATE * dt
        scrubRef.current.pixels += g.keyDir * KEY_SCRUB_PX * dt
      } else {
        // The hook banks horizontal pixels between frames; spend them all.
        const px = g.scrubPending
        g.scrubPending = 0
        deltaSeconds = px * SECONDS_PER_PX
        scrubRef.current.pixels += px
      }
      scrubRef.current.seconds += deltaSeconds

      // The hand has stopped. Only the render loop can notice that — a hand
      // holding still sends no events at all.
      if (!g.keyDir && performance.now() - g.lastHMoveAt > SCRUB_REST_MS) endScrub?.()
    }

    if (deltaSeconds !== 0) {
      if (videoEl && videoEl.duration) {
        const d = videoEl.duration
        const next = (((videoEl.currentTime + deltaSeconds) % d) + d) % d
        // Seek storms cost more than they show; ignore sub-frame moves.
        if (Math.abs(next - videoEl.currentTime) > 0.02) videoEl.currentTime = next
      } else {
        standInOffsetRef.current += deltaSeconds
      }
    }

    // Normalised shuttle speed, smoothed so the smear has weight.
    const rate = dt > 0 ? deltaSeconds / dt : 0
    const target = Math.max(-1, Math.min(1, rate / FULL_SHUTTLE))
    shuttleRef.current += (target - shuttleRef.current) * Math.min(1, dt * 9)

    // --- the frame --------------------------------------------------------
    if (standIn) {
      standIn.draw(t + standInOffsetRef.current)
      texture.needsUpdate = true
    }

    // --- the reveal -------------------------------------------------------
    const holding = g.holding
    revealRef.current = advanceReveal(revealRef.current, holding, dt)
    const reveal = revealRef.current
    const eased = smoothstep01(reveal)

    // The hand's warmth soaks in slowly and leaves the instant it lifts.
    const wipeTarget = holding ? 1 : 0
    const wipeRate = holding ? 2.6 : 7.0
    wipeRef.current += (wipeTarget - wipeRef.current) * Math.min(1, dt * wipeRate)

    // --- one clock --------------------------------------------------------
    beatRef.current += (dt * bpmFor(eased)) / 60
    const pulse = heartbeat(beatRef.current)
    const br = breath(t)

    // Breathing folded into the distortion: a heartbeat transient plus a slow
    // sine. It only lives in the steam, so a fully revealed frame is still.
    const amp = reducedMotion ? 0.3 : 1
    const wobble = 1 + amp * (0.11 * pulse + 0.05 * Math.sin(t * 0.73))
    const steam = clamp01((1 - eased) * wobble)

    // --- geometry ---------------------------------------------------------
    const p = g.pointer
    smoothPointer.current.lerp(tmpPointer.set(p.x, p.y), Math.min(1, dt * 6))

    const planeAspect = size.width / Math.max(size.height, 1)
    const texAspect = videoEl?.videoWidth
      ? videoEl.videoWidth / videoEl.videoHeight
      : standIn
        ? standIn.canvas.width / standIn.canvas.height
        : 16 / 9
    aspectRef.current = texAspect

    if (planeAspect > texAspect) u.uCoverScale.value.set(1, texAspect / planeAspect)
    else u.uCoverScale.value.set(planeAspect / texAspect, 1)

    // --- a mark opening ---------------------------------------------------
    const spark = sparkRef.current
    if (spark && spark.at !== sparkRef2.current.at) {
      sparkRef2.current = { amount: 1, at: spark.at }
      // Film coordinates (y down) -> texture uv -> plane uv.
      const s = u.uCoverScale.value
      u.uSparkPos.value.set(
        (spark.u - 0.5) / s.x + 0.5,
        (1 - spark.v - 0.5) / s.y + 0.5,
      )
    }
    sparkRef2.current.amount = Math.max(0, sparkRef2.current.amount - dt / SPARK_SECONDS)

    // --- uniforms ---------------------------------------------------------
    u.uPlaneAspect.value = planeAspect
    u.uTime.value = t
    u.uSteam.value = steam
    u.uReveal.value = eased
    u.uPulse.value = pulse
    u.uBreath.value = br
    u.uWipe.value = wipeRef.current
    u.uScrub.value = shuttleRef.current
    u.uSpark.value = sparkRef2.current.amount
    u.uPointer.value.copy(smoothPointer.current)

    // --- everything else reads from here ----------------------------------
    audioRef.current?.update(eased, dt, br, shuttleRef.current)

    signalsRef.current.reveal = eased
    signalsRef.current.steam = steam
    signalsRef.current.pulse = pulse
    signalsRef.current.holding = holding
    signalsRef.current.shuttle = shuttleRef.current

    const clear = reveal > CLEAR_THRESHOLD
    if (clear !== wasClearRef.current) {
      wasClearRef.current = clear
      onClearChange?.(clear)
    }
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
