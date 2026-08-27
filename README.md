# EROTICAD — Behind the Steam

A hold-to-reveal WebGL tease. The film plays the whole time; you just can't see
it. It sits behind a sheet of condensation that only clears while you keep your
hand on the glass — and closes back over in about a third of a second when you
let go.

Built with Vite, React, Tailwind and React Three Fiber, with the censor written
as a raw GLSL fragment shader.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build && npm run preview
```

---

## The mechanic

| State       | What you see                                                        | What you hear                                                        |
| ----------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Covered** | Warm fog, silhouette, skin glow, droplets and the odd rivulet. No legible detail. | The track behind a 180 Hz low-pass with the resonance wide open, and a heartbeat at 54 bpm. |
| **Holding** | The fog melts — slowly at first, then faster. The palm clears a soft, irregular patch first. | The filter opens exponentially to 18 kHz, the heart backs off, the breath layer comes forward. |
| **Clear**   | The film, untouched, with a whisper of warmth and a hair of chromatic aberration. | Full band, pulse up at 92 bpm.                                        |
| **Released**| The steam rushes back.                                              | The door shuts with it.                                               |

Hold the glass clear for three seconds and the shop materialises — and stays
for six seconds after you let go, because you have to release the glass to
reach for it.

Press and hold works from a mouse, a finger, or the space bar.

---

## Architecture

```
src/
  App.jsx                  gate -> boot -> live, and the CTA latch
  components/
    AgeGate.jsx            nothing exists until someone says yes
    Stage.jsx              the R3F canvas: orthographic, flat, adaptive DPR
    SteamPlane.jsx         the single frame loop everything else reads from
    Overlay.jsx            interface; paints from the same signals, never re-renders per frame
  shaders/
    steam.vert.glsl        the pane, breathing
    steam.frag.glsl        the censor
  lib/
    pulse.js               heartbeat, respiration, and the reveal curve
    AudioEngine.js         the filter graph, and a synth bed when there is no track
    media.js               source candidates
    loadMedia.js           first-that-decodes loader
    standin.js             procedural footage for when nothing loads
  hooks/
    useHold.js             press-and-hold across pointer, touch and keyboard
    useReducedMotion.js
```

### One clock

`SteamPlane`'s `useFrame` is the only loop that advances state. It drives the
uniforms, calls `AudioEngine.update()`, and writes to a plain `signalsRef` that
the overlay reads in its own rAF pass. So the fog thickens on exactly the beat
the bass lands on, and the plane swells on exactly the beat the filter ducks on
— nothing is animated independently, which is most of why it reads as a body
rather than a page.

React only hears about two transitions: clear-held and no-longer-clear.

---

## The shader

`steam.frag.glsl` runs the frame through five stages. `uSteam` (1 fogged, 0
dry) scales all of them, so the dry state is a genuine passthrough rather than
a very weak effect.

**1. Warp.** Two fbm fields drift at different speeds and directions and push
the sample coordinate around by up to 8.5% of the frame. The slow layer is the
body of the steam; the fast one is the shimmer that makes it read as warm air.

**2. Blur.** A 28-tap golden-angle poisson disc, twice — once wide, once at a
third of the radius — mixed 62/38. The tap rotation is jittered per-pixel *and*
per-frame from `gl_FragCoord`, so the structure a finite tap count would
otherwise leave behind dissolves into moving grain instead of resolving into a
recognisable shape. Offsets are corrected by both the plane aspect and the
cover-fit scale, so the disc stays circular on screen at any viewport.

**3. Skin bleed.** At full steam the image collapses onto a warm three-point
luminance ramp — shadow, mid, skin — mixed in at 82%. Highlights bloom through
before anything else does. What survives is heat, silhouette and movement: you
can tell there is a body, and that is all.

**4. The veil.** A fog-modulated haze, tinted a little redder on each
heartbeat; small beads that refract what is behind them through a cheap
numeric-gradient normal; and rivulets — narrow wobbling channels where a bead
has run and wiped a sliver of glass, the only place any detail is allowed to
leak while the pane is fogged.

**5. Finish.** Vignette, heartbeat exposure, and grain that thickens with the
steam.

### Breathing

`uSteam` is not just `1 - reveal`. It carries a heartbeat transient and a slow
sine:

```js
const wobble = 1 + amp * (0.11 * pulse + 0.05 * Math.sin(t * 0.73))
const steam  = clamp01((1 - eased) * wobble)
```

Because it multiplies the fogged amount, a fully revealed frame is perfectly
still — the breathing only exists in the steam. `heartbeat()` is a double
thump, lub then a softer dub, and its tempo rises from 54 to 92 bpm as the
reveal opens. `amp` drops to 0.3 under `prefers-reduced-motion`.

### The reveal curve

Deliberately not a lerp, and deliberately not symmetric:

```js
holding ? (0.16 + 1.15 * reveal) * dt      // ~1.8s, slow at first, then faster
        : -(2.4 + 3.0 * (1 - reveal)) * dt // ~0.3s, and no hesitation in it
```

The frame delta is clamped to 1/20s, so a backgrounded tab returning with a
huge delta cannot snap the glass open on its first frame back.

---

## The audio

One `BiquadFilterNode` is the whole idea: the bed lives behind it, and the
reveal opens it from 180 Hz to 18 kHz on an exponential curve while the
resonance falls from Q 7.5 to 0.7 — muffled and in-the-ears at one end, open
and present at the other. The heartbeat bus is scheduled from the same beat
counter the shader reads and fades from 0.85 to 0.12 as the view clears. The
breath layer sits *outside* the low-pass and comes up on `reveal^1.6`.

The `AudioContext` is opened synchronously inside the gate click, before any
`await` — waiting for the media to load first would spend the user activation
and leave the context suspended on Safari.

**With no track**, the engine synthesises its own: sub, an Am9 pad with slow
per-voice detune drift, and a bass note on each beat — all behind the same
filter, so the mechanic is fully audible with no assets at all.

---

## Media

`src/lib/media.js` holds an ordered candidate list per source. Local files in
`public/media/` are tried first (see the note there), then free remote
stand-ins, and whatever decodes first wins.

If everything fails — offline, blocked host, dead link — `standin.js` paints a
procedural body in candlelight straight into the shader and the audio engine
synthesises its bed. The experience never shows a dead screen.

The remote stand-ins are development placeholders and are not guaranteed to
stay up; ship your own from `public/media/`.

---

## Notes

- **Performance.** The fragment shader is expensive by design — 59 texture taps
  and several fbm fields per pixel. DPR is capped at 1.75 and drei's
  `AdaptiveDpr` drops it further under load: a stuttering tease is not a tease.
- **Safety.** No video element is created, no texture is uploaded and no audio
  graph exists before the age gate is answered. Nothing explicit is on screen
  beforehand, not even fogged. Every way a hold can end — pointer up, pointer
  cancel, a finger dragged off the glass, tab blur, window hidden — closes the
  steam, so losing focus can never leave the frame uncovered.
- **Accessibility.** Space or Enter holds the glass. `prefers-reduced-motion`
  damps the breathing and shortens the interface transitions.
