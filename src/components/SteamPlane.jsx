import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import vertexShader from '../shaders/steam.vert.glsl?raw'
import fragmentShader from '../shaders/steam.frag.glsl?raw'
import { advanceReveal, bpmFor, breath, clamp01, heartbeat, smoothstep01 } from '../lib/pulse.js'

const CLEAR_THRESHOLD = 0.985

// Reused every frame so the loop never allocates.
const tmpPointer = new THREE.Vector2()

/**
 * The pane. Everything that moves — the fog, the pulse, the filter cutoff, the
 * CTA timer — is driven from this single frame loop, so the picture, the sound
 * and the interface can never drift out of phase with each other.
 */
export default function SteamPlane({
  videoEl,
  standIn,
  holdRef,
  pointerRef,
  audioRef,
  signalsRef,
  onClearChange,
  reducedMotion = false,
}) {
  const materialRef = useRef()
  const revealRef = useRef(0)
  const wipeRef = useRef(0)
  const beatRef = useRef(0)
  const wasClearRef = useRef(false)
  const smoothPointer = useRef(new THREE.Vector2(0.5, 0.5))

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
    // A tab that was backgrounded returns with a huge delta; clamping it stops
    // the reveal from snapping wide open on the first frame back.
    const dt = Math.min(rawDelta, 1 / 20)
    const t = state.clock.elapsedTime
    const material = materialRef.current
    if (!material) return
    const u = material.uniforms

    if (standIn) {
      standIn.draw(t)
      texture.needsUpdate = true
    }

    // --- the reveal -------------------------------------------------------
    const holding = holdRef.current
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

    // --- uniforms ---------------------------------------------------------
    const p = pointerRef.current
    smoothPointer.current.lerp(tmpPointer.set(p.x, p.y), Math.min(1, dt * 6))

    const planeAspect = size.width / Math.max(size.height, 1)
    const texAspect = videoEl?.videoWidth
      ? videoEl.videoWidth / videoEl.videoHeight
      : standIn
        ? standIn.canvas.width / standIn.canvas.height
        : 16 / 9

    if (planeAspect > texAspect) u.uCoverScale.value.set(1, texAspect / planeAspect)
    else u.uCoverScale.value.set(planeAspect / texAspect, 1)

    u.uPlaneAspect.value = planeAspect
    u.uTime.value = t
    u.uSteam.value = steam
    u.uReveal.value = eased
    u.uPulse.value = pulse
    u.uBreath.value = br
    u.uWipe.value = wipeRef.current
    u.uPointer.value.copy(smoothPointer.current)

    // --- everything else reads from here ----------------------------------
    audioRef.current?.update(eased, dt, br)

    if (signalsRef) {
      signalsRef.current.reveal = eased
      signalsRef.current.steam = steam
      signalsRef.current.pulse = pulse
      signalsRef.current.holding = holding
    }

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
