import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'

import SteamPlane from './SteamPlane.jsx'

/**
 * The fragment shader is expensive by design — 50+ texture taps and several
 * fbm fields per pixel — so the canvas is capped and allowed to drop its pixel
 * ratio under load rather than dropping frames. A stuttering tease is not a
 * tease.
 */
export default function Stage(props) {
  return (
    <Canvas
      className="fixed inset-0 z-10"
      orthographic
      camera={{ position: [0, 0, 5], zoom: 1 }}
      dpr={[1, 1.75]}
      flat
      performance={{ min: 0.55 }}
      gl={{
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      }}
    >
      <color attach="background" args={['#040203']} />
      <SteamPlane {...props} />
      <AdaptiveDpr pixelated={false} />
      <AdaptiveEvents />
    </Canvas>
  )
}
