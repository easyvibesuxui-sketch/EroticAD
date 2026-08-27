import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'

import FilmPlane from './FilmPlane.jsx'

/**
 * The stage never moves. Ten sections scroll past it; it just shows the right
 * two seconds of film.
 */
export default function FilmStage(props) {
  return (
    <Canvas
      className="!fixed inset-0 z-10"
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
      <FilmPlane {...props} />
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  )
}
