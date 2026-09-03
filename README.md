# Maison Ondine — Collection Première

A shop for ten pieces of lingerie, in which nothing comes off on its own.

Each section is one piece: its approach clip plays itself and stops, and the
last stretch only moves if you move it. Only once the piece is off are you told
what it was and what it costs.

That is the whole site rule. A gold mark appears where the action is, dashes
point the way, and dragging along them runs the film frame by frame: the strap
comes down as your hand comes down, and goes back up if you drag back. Nothing
is animated. The hand is the transport.

Built with Vite, React, Tailwind and React Three Fiber, with the film rendered
through a raw GLSL fragment shader.

```bash
npm install
npm run dev              # http://localhost:5173
npm run build && npm run preview
npm run build:artifact   # one self-contained HTML file
```

---

## The rule

```
scroll to a section
   │
   ├─ playing   the section's approach clip runs itself, and ends
   │
   ├─ armed     the playhead stops. The mark appears where the action is.
   │
   └─ hand      drag along the dashes  →  seconds 6→8, frame by frame
                drag back              →  seconds 8→6, and it un-happens
                let go past 82%        →  it settles open, and the mark is done
                let go short of it     →  it winds back to where it started
```

Then scroll on. The next section does the same thing with a different action,
in a different place, in a different direction.

**Three guide shapes.** A straight pull, a turn about a centre, and a route the
hand has to trace. Which one a step uses is the step's own business — the mark,
the drag and the hit surface all follow from `track`.

```
line     Mark.jsx      useDirectionalDrag   travel projected onto a direction
ring     RingMark.jsx  useAngularDrag       the angle the hand stands at
zigzag   PathMark.jsx  usePathDrag          distance along a polyline
```

The route is a route and not a decoration: `usePathDrag` only advances while
the hand is inside a corridor around the line, so cutting the corners of a
zigzag moves nothing at all. Verified — a straight drag across section seven's
guide leaves the film exactly where it was.

**A section can be more than one action.** Most are one clip pulled along a
line. Section two is two clips, each turned around a circle — both hands take
the lace and roll it down, and a roll is a turn, so the guide is a ring and the
hand goes round it. The second ring is the first one turned over: it starts
where the first finished and runs back the other way.

```
armed, step 0   ring, clockwise    →  clip 02b, frame by frame
   │  wound all the way            →  clip 02c takes the film, at its start
   ▼
armed, step 1   ring, anticlockwise →  clip 02c, frame by frame
      wound back past its own start →  clip 02b takes it again, fully wound
```

The two clips meet on the same picture — 0.36 of a grey level apart out of 255,
measured — so the handover is invisible. A section counts as done when its
*last* action is done, not its first.

| | |
| --- | --- |
| Sections | 10 |
| Autoplay per section | however long its approach clip runs |
| Mechanical per section | however long its action clip runs |
| Film length | ~100s, as ten approaches and their actions |

Ten ticks down the right edge show where you are; a tick turns **gold** when its
action has actually been performed — not when its section has been passed. That
difference is the site: a piece you have not undressed is a piece you have not
been offered.

The house lives in one file, `src/lib/brand.js` — name, wordmark, season, price
formatting. The mark itself is in `Wordmark.jsx`, and it is deliberately the
same hairline ring, the same gap, the same terminus dot that every section asks
you to drag: the logo and the gesture are the same object.

Copy is set over the film with a text shadow rather than a scrim. The film is
the product; nothing in the interface is allowed to dim it.

---

## Why the last two seconds are scrubbed, not played

A played animation happens *to* you. A scrubbed one happens *because of* you,
at your speed, and stops where you stop. It is reversible for free, because it
is just a position in a range — dragging back is not an "undo", it is the same
two seconds read the other way.

It also means the footage carries the performance. There is no rigging, no
sprite, no CSS approximation of fabric: the strap falls exactly the way it
fell on the day, because it is the take.

The cost lands on the encode, not the code — see
[`docs/MEDIA-PLAN.md`](docs/MEDIA-PLAN.md).

---

## Architecture

```
src/
  App.jsx                  gate -> boot -> live; owns the active section
  components/
    AgeGate.jsx            nothing exists until someone says yes
    FilmStage.jsx          the fixed R3F canvas the sections scroll past
    FilmPlane.jsx          the transport: playing / armed, and every uniform
    Mark.jsx               ring, chevron, dashed path, terminus, progress arc
    SectionIndicator.jsx   places the mark on the film and wires it to the hand
    Wordmark.jsx           the mark, which is the ring from the sections
    ScrollTrack.jsx        ten empty sections: the film's line, then the piece
    SectionRail.jsx        where you are, and what you have undone
  shaders/
    steam.vert.glsl        the pane, breathing
    steam.frag.glsl        haze, skin bleed, beads, shuttle smear, gold bloom
  lib/
    sections.js            the ten: timings, mark positions, directions, copy
    Playhead.js            seconds in, frames out — over a <video> or a clock
    filmSources.js         which clip a section plays, and what it falls back to
    layout.js              cover-fit mapping shared by the shader and the marks
    pulse.js               heartbeat, respiration
    AudioEngine.js         the filter graph, and a synth bed when there is no track
    media.js / loadMedia.js  source candidates, first-that-decodes
    standin.js             procedural footage for when nothing loads
  hooks/
    useSectionNavigation.js  one gesture, one section — wheel, swipe and keys
    useDirectionalDrag.js  pointer travel -> 0..1 along a direction
    useReducedMotion.js
```

### One transport, one clock

`FilmPlane`'s `useFrame` is the only thing that moves the playhead. Every frame
it asks which section the page is on, decides whether that section is playing
itself or waiting for a hand, and puts the right frame up. React hears about
two things: the section index and the transport phase.

The hold is checked per frame rather than on `timeupdate`, which fires four
times a second and would overshoot by up to 200ms — a fifth of a second past
the mark is a visibly wrong frame to stop on.

### `Playhead` — seconds in, frames out

Everything above it talks in seconds. Underneath is either a real `<video>` or
a virtual clock driving procedural stand-in footage, and nothing else can tell
the difference. That is what makes the whole architecture testable before a
frame has been shot — and it is what you are seeing if you open this with no
media in `public/media/`.

The virtual clock runs on wall time, not on render deltas: a film does not play
in slow motion because the GPU is busy, and the stand-in must not either.

### Moving between sections

CSS scroll snapping was the obvious answer and it does not work here. Measured,
with `y mandatory` and `scroll-snap-align: start` on every section: one wheel
gesture came to rest at 420px — *between* two sections — the next did nothing at
all, the one after jumped 840px, and a flick landed at 3700px, aligned to
nothing. `scroll-behavior: smooth` and mandatory snapping fight each other, and
nothing stops a flick crossing several snap points anyway.

So the wheel, the swipe and the keys are read directly and each moves exactly
one section. The document still scrolls, so the scrollbar and assistive
technology keep working — but a section boundary is the only position ever
asked for.

Two details earn their keep:

- **The move is a cut, not a scroll.** The stage is fixed, so a section change
  moves nothing except the copy and the rail, and both already cross-fade over
  ~900ms. An animated scroll would animate only the scrollbar — while being the
  one part of this that needs a free main thread. With the shader running, a
  smooth 844px scroll had not finished 2.6 seconds later and the film sat a
  whole section ahead of the page.
- **Momentum is waited out, not timed out.** After a move, wheel input is
  swallowed until it has been quiet for 150ms. A fixed timeout either cuts the
  trackpad's tail off too early — and that tail moves a second section — or is
  long enough to make the page feel dead.

### The drag

Pointer travel projected onto the section's direction, divided by the mark's
path length. That is the whole calculation. Three details make it feel like an
object rather than a slider:

- **The anchor is offset by what is already wound on**, so picking the handle
  back up continues from where it sits instead of snapping to the finger.
- **Release commits or reverts** — past 82% it settles open, short of it it
  winds back. Halfway is not a state a garment can be left in.
- **The hit surface is a band around the mark's travel, not the screen.** It
  has to be: the gesture is a drag and on a phone a drag is also a scroll. Only
  the region the mark occupies may claim the touch; everywhere else the page
  still scrolls, which is how you leave a section.

Space or Enter performs the action without the dexterity.

---

## The shader

The film never reaches the eye directly. `steam.frag.glsl` runs each frame
through five stages, all scaled by `uSteam` so a clear section is a genuine
passthrough rather than a weak effect:

**1. Warp.** Two fbm fields drift at different speeds and push the sample
coordinate around. The slow one is the body of the haze; the fast one is the
shimmer that makes it read as warm air.

**2. Blur.** A 28-tap golden-angle poisson disc, twice — once wide, once at a
third of the radius. The tap rotation is jittered per-pixel *and* per-frame
from `gl_FragCoord`, so the structure a finite tap count would leave behind
dissolves into moving grain instead of resolving into a recognisable shape.
Offsets are corrected by both the plane aspect and the cover-fit scale, so the
disc stays circular at any viewport.

**3. Skin bleed.** At full steam the image collapses onto a warm three-point
luminance ramp — shadow, mid, skin. What survives is heat, silhouette and
movement.

**4. The veil.** Fog-modulated haze tinted redder on each heartbeat, beads that
refract through a cheap numeric-gradient normal, and rivulets where a bead has
run and wiped a sliver of glass.

**5. Finish.** Vignette, heartbeat exposure, grain that thickens with the haze.

Two uniforms belong to the mechanic. `uScrub` smears the frame *behind* its own
direction of travel and sweeps a soft tape bar through it — winding film by
hand looks like winding film by hand. `uSpark` blooms gold where an action
commits, with a ring travelling out from it.

Each section sets its own `steam` in `sections.js`, and the hand clears it: the
haze is a held breath and the action lets it out. The mark's position is fed to
`uPointer`, so the frame thins first exactly where the hand is working.

---

## The audio

One `BiquadFilterNode` carries the idea: the bed lives behind it, and the
action opens it from 180 Hz to 18 kHz on an exponential curve while the
resonance falls from Q 7.5 to 0.7. The heartbeat bus runs off the same beat
counter the shader reads and recedes as the action completes. Committing rings
a three-partial chime routed around the filter — the one sound allowed to cut
through.

The **second audio** (`public/media/after.mp3`) belongs to the end of a section
rather than to the drag. It sits outside the filter, silent, until the mark
lands past the threshold; then `AudioEngine.after()` plays it once, in the
clear. Dragging the piece back on calls `stopAfter()` and it goes with the
action — nothing on this page is allowed to be the one thing that cannot be
undone. Leaving the section stops it too. With no file, the engine breathes one
itself: a noise band swept 700 → 1250 → 620 Hz over four seconds.

The `AudioContext` is opened synchronously inside the gate click, before any
`await`: waiting for media first spends the user activation and leaves the
context suspended on Safari.

With no track, the engine synthesises its own — sub, an Am9 pad with slow
per-voice detune drift, and a bass note on each beat, all behind the same
filter.

---

## Media

`src/lib/media.js` holds an ordered candidate list per source; local files in
`public/media/` are tried first. If everything fails, `standin.js` paints
procedural footage into the shader and the audio engine synthesises its bed, so
the mechanic is never a dead screen.

**In place:** `public/media/track.mp3` (2:57, VBR, 48 kHz) and
section one as a pair — `01a-approach.mp4` (7.63s) and `01b-action.mp4` (2.42s,
all-intra), and section two as an approach and two actions — `02a` (6.25s), `02b` (2.00s) and `02c` (1.79s), both actions all-intra. Still wanted: eight more sections and `after.mp3`.

Each section is delivered as an approach that plays itself plus one or more
actions the hand moves, split where each begins. That split is the entire timing model —
nothing in the code names a second. A section without a pair falls back to a
shared cut, then to the stand-in.

`npm run build:artifact` embeds whatever is in `public/media/` as data URIs, so
the single-file build carries its own sound. Base64 costs a third in size —
budget for it against the 16 MB ceiling.

What the footage actually has to be — and why the encode matters more than the
camera — is in [`docs/MEDIA-PLAN.md`](docs/MEDIA-PLAN.md).

---

## Notes

- **Performance.** The fragment shader is expensive by design — 59 texture taps
  and several fbm fields per pixel. DPR is capped at 1.75 and drei's
  `AdaptiveDpr` drops it further under load.
- **Safety.** No video element is created, no texture is uploaded and no audio
  graph exists before the age gate is answered, and the page does not scroll
  until it is.
- **Accessibility.** Every action has a keyboard equivalent — space performs
  the section's action, arrows and Page Up/Down move between sections, Home and
  End jump to the ends — the mark is a labelled control with a visible focus
  ring, and `prefers-reduced-motion` damps the breathing.
- **Frame-rate honesty.** Every timed thing — the drag settle, the mark's
  arrival, the haze — eases over elapsed time rather than over frames. A
  threshold tuned at 60fps that silently breaks at 30 is the bug this project
  keeps finding.
- **No per-frame React.** The mark and the transport are driven straight into
  the DOM and into uniforms from loops that read refs. React re-renders when
  the section changes, when the phase changes, and when an action commits.
