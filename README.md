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

## The gold layer

Once the glass is clear, marks appear on the film. They are the whole
vocabulary of the piece: **a ring, a chevron, and a dashed path saying where
the hand goes next.**

| Mark      | Looks like                                            | Gesture                                      |
| --------- | ----------------------------------------------------- | -------------------------------------------- |
| **Pull**  | A ring with a chevron, a dashed guide, a terminus dot. | Drag the ring along the dashes to the end.    |
| **Dwell** | A bare dot inside a dashed circle.                     | Rest on it. The circle closes in 1.1 seconds. |
| **Shuttle** | A dashed rail under the hand, ring handle, `− 3.4s`. | Sweep sideways. Left rewinds, right runs on.  |

Opening a mark blooms gold at that point in the shader, sounds a chime *outside*
the low-pass, buzzes the phone, and names the piece. It stays open five seconds,
then closes so the frame is clean again.

Marks are authored in **film coordinates** (`src/lib/traces.js`) and mapped
through the same cover-fit transform the shader uses, so a mark placed on a
clasp stays on that clasp at any window shape. Re-author them against the real
cut — they are the only content-specific thing in the project.

### One hand, four meanings

Everything comes out of a single pointer stream, because the marks only exist
while the glass is clear, and the glass is only clear while the pointer is
down. Anything needing a second press would be unreachable — you would have to
let go, and letting go closes everything it was there to open.

```
idle ──press──▶ hold ──sideways travel──▶ scrub ──hand stops (450ms)──▶ hold
                 │                          │
                 └──── along a mark's dashes ┴──▶ trace ──opens/abandoned──▶ hold
```

The arbitration rules are the part worth knowing:

- **A mark outranks the shuttle.** Arriving at one ends any sweep in progress,
  so the film is still by the time the pull starts. This is also what stops a
  reach across the frame from rewinding: the reach ends *at* a mark.
- **Scrub engagement is not speed-gated.** A velocity threshold behaves
  differently on every frame rate, and a shuttle that only works on fast
  hardware is worse than one that occasionally starts early.
- **Pull distance is measured from where the hand reached the mark**, not from
  the press — by then the hand has been resting somewhere else for a second or
  two, and that journey is not part of the pull. Forward motion accumulates;
  only wandering backwards or sideways re-anchors it.
- **An open mark never takes the hand again**, or you could not leave what you
  just opened without lifting off the glass.
- **Ending a shuttle belongs to the render loop.** A hand holding still sends
  no events at all, so a mode that could only be left by moving would never be
  left.

Arrow keys shuttle; space or enter holds.

---

## Architecture

```
src/
  App.jsx                  gate -> boot -> live, and the CTA latch
  components/
    AgeGate.jsx            nothing exists until someone says yes
    Stage.jsx              the R3F canvas: orthographic, flat, adaptive DPR
    SteamPlane.jsx         the single frame loop everything else reads from
    Trace.jsx              one gold mark: ring, chevron, dashed path, label
    TraceLayer.jsx         places the marks and drives arming, pulls and dwells
    ScrubRail.jsx          the rewind/forward rail, handle and readout
    Overlay.jsx            interface; paints from the same signals, never re-renders per frame
  shaders/
    steam.vert.glsl        the pane, breathing
    steam.frag.glsl        the censor
  lib/
    pulse.js               heartbeat, respiration, and the reveal curve
    traces.js              the marks: film coordinates, direction, copy
    layout.js              cover-fit mapping shared by the shader and the marks
    AudioEngine.js         the filter graph, and a synth bed when there is no track
    media.js               source candidates
    loadMedia.js           first-that-decodes loader
    standin.js             procedural footage for when nothing loads
  hooks/
    useGestures.js         one pointer stream -> hold / scrub / trace / idle
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

Two more uniforms belong to the gold layer. `uScrub` (−1..1) smears the frame
along its own direction of travel — the trail sits *behind* the motion, never
symmetrically around it — widens the chromatic split, desaturates a touch, and
sweeps one soft tape bar through the frame: machinery, not glitch. `uSpark`
blooms gold at `uSparkPos` for 0.9s when a mark opens, with a ring travelling
out from it.

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

Rewinding is audible: filtered noise whose pitch and brightness follow the
shuttle speed, over a bed ducked by 50%. A mark opening rings a three-partial
chime routed *around* the low-pass — the one sound allowed to cut through
whatever the glass is doing.

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
- **Accessibility.** Space or Enter holds the glass, arrow keys shuttle the
  film. `prefers-reduced-motion` damps the breathing and shortens the interface
  transitions.
- **Frame-rate honesty.** Every timed gesture (the reveal, the dwell, the
  shuttle fuse, every interface fade) is smoothed over elapsed time rather than
  over frames, and the delta clamps are deliberately loose. A hold that takes
  twice as long on a slow phone is a worse bug than a single fast frame.
- **No per-frame React.** The marks, the rail and the interface are driven
  straight into the DOM from rAF loops reading the same signals object the
  shader writes. React hears about four transitions in total: the gate, the
  clear-hold, a mark opening, and the gesture mode (which is published as
  `data-mode` on `<main>`, and drives the cursor).
