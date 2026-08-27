/**
 * One clock for the whole experience.
 *
 * The visuals and the audio both read from these functions, so the fog
 * thickens on exactly the beat you feel in the bass, and the plane swells on
 * exactly the beat the low-pass filter ducks on. Nothing is animated
 * independently — that is what makes it feel like a body rather than a page.
 */

/** Resting pulse when the glass is fogged, and where it climbs to. */
export const BPM_CALM = 54;
export const BPM_AROUSED = 92;

export const bpmFor = (reveal) => BPM_CALM + (BPM_AROUSED - BPM_CALM) * reveal;

/**
 * A heartbeat is two sounds, not one: the lub, then a softer, quicker dub.
 * Returns 0..1, spiking twice per cycle.
 */
export function heartbeat(phase) {
  const p = phase - Math.floor(phase);
  const thump = (c, w) => {
    const x = (p - c) / w;
    return Math.exp(-(x * x));
  };
  const v = thump(0, 0.05) + thump(1, 0.05) + 0.55 * thump(0.2, 0.065);
  return Math.min(1, v);
}

/** Slow respiration, ~7 breaths a minute. Rises quicker than it falls. */
export function breath(t) {
  const s = Math.sin(t * 0.73);
  return 0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), 0.72);
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep01 = (v) => v * v * (3 - 2 * v);

/**
 * The reveal curve.
 *
 * Deliberately not a lerp. Holding is slow at first — the glass resists, you
 * have to mean it — and then gives way faster and faster. Letting go is not
 * the same motion in reverse: the steam rushes back, quickly, and there is no
 * hesitation in it.
 */
export function advanceReveal(reveal, holding, dt) {
  const step = holding
    ? (0.16 + 1.15 * reveal) * dt // ~1.8s from fogged to clear
    : -(2.4 + 3.0 * (1 - reveal)) * dt // ~0.3s back under
  return clamp01(reveal + step);
}
