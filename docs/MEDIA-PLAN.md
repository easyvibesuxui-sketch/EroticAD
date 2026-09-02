# Media plan — ten clips of ten seconds

**One clip per section**, which is how the film is actually being delivered and
how it should be: ten locked-off setups, each its own file. Plus a portrait
render of each, and optionally the long-form scene behind the final CTA.

Each section owns its own indicator, so **cuts between sections are free**:
section three can be a different angle, a different lens, a different room.

The constraints have moved from the shoot to the edit and the encode. One of
them is currently unmet — see *What the first clip tells us*.

---

## What the code consumes

| Slot | File | Count |
| --- | --- | --- |
| Each section's clip | `public/media/sections/<nn>-<id>.mp4` | 10 |
| The bed | `public/media/track.mp3` | 1 ✅ |
| The close layer (breath, fabric, room) | `public/media/breath.mp3` | 1 |

A section names its own clip in `src/lib/sections.js` and carries its own
timings with it, so clips need not all be the same length — section one is
`autoplay: 8, scrub: 2`. A section with no clip yet falls back to a shared cut
if one exists, and to the procedural stand-in if not, so the site runs with ten
files, one, or none.

Delivered so far: **section 1** (`01-robe.mp4`) — 10.04s, 1280×720, 24fps.

---

## What the first clip taught us

The delivered file parsed clean — 10.042s, 1280×720, 24fps, H.264, `moov` ahead
of `mdat` — with one fatal property. Its sync-sample table read:

> **1 keyframe, at 0.00s, for all 241 frames.**

The action range starts at 8.04s, so every seek into it had to decode **193
frames from the beginning of the file**. Dragging forward might have survived on
decoder cache; dragging *back*, which the mechanic is built on, would have
re-decoded from zero every time.

Re-encoded through the command below:

| | delivered | re-encoded |
| --- | --- | --- |
| Keyframes | 1 of 241 | **41 of 241** |
| Largest gap between them | — | 0.25s |
| Worst decode to reach the action range | **8.04s of frames** | **0.04s — one frame** |
| Size | 6.82 MB | **6.46 MB** |

It got *smaller*. The original was spending its bitrate on one enormous GOP.

**Encode every clip this way before it is delivered.** It is the difference
between a control and a slideshow, and it costs nothing.

### Framing: this shot does not survive the portrait crop

At the hold frame the two hands sit at u 0.36 and u 0.64, and they travel out to
roughly u 0.10 and u 0.96. On a 390×844 phone the visible slice of a 16:9 film is
u ∈ [0.37, 0.63] — so the hands start just inside it and **leave the frame
almost immediately**. On a phone the section would begin and then appear to
stop.

This is the portrait-render requirement biting for real. Either frame the action
within the central 26% of the width, or deliver the 9:16 cut with its own mark
positions (`u`/`v` are film coordinates, so the same section can carry a second
pair).

## The shape of each clip

```
0s ─────────── 7.4s ══════ 10.0s      section one, as delivered
   plays itself     the hand
```

**The split is per clip, not a rule.** Section one is `autoplay: 7.4,
scrub: 2.6` because that is where its action actually begins — she rises and
comes to the lens for the first seven and a half seconds, and the robe does not
start to open until 7.40. Holding at the 8s default handed the first six-tenths
of the action to the autoplay and left the hand with the leftovers.

**So say where the action starts.** One number per clip. Otherwise it gets
measured off the frames, which works but is guesswork with better tools.

**Seconds 0–8 — the approach.** Normal filmmaking. It plays once, at speed,
and stops. Land the hold on a frame worth stopping on: this is the
image people look at while they work out what to do. It should be composed,
still, and slightly unresolved.

**The action.** One continuous physical movement, and only one:
a strap slipping, hair going back, a ribbon coming loose. Rules for these two
seconds:

- **Locked off.** Absolutely no camera movement. The mark is pinned to a point
  in the frame, and if the frame moves, the mark slides off the thing it
  belongs to.
- **It must read backwards.** These two seconds are scrubbed in both
  directions. Anything that only makes sense forwards — a splash, a fall,
  something leaving frame — looks wrong on the way back.
- **Monotonic.** The action should move steadily in one direction across the
  two seconds. A pause or a bounce in the middle turns into a dead zone the
  hand has to drag through.
- **One axis.** The gesture is a straight drag. Match the direction in
  `sections.js` to the direction the movement actually reads on screen.
- **No cut inside it.** Obviously, but worth saying.

Shoot the action longer than two seconds and choose the two in the edit — the
best two seconds of a strap falling are rarely the first two.

---

## Encoding — the part that decides whether this feels good

The scrub sets `currentTime` directly. Seek cost is the distance back to the
previous keyframe, so a default 2–5 second GOP means the film lurches between
keyframes instead of moving with the hand. **This is the single technical thing
that makes or breaks the site.**

```bash
ffmpeg -i master.mov \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -crf 21 -preset slow \
  -g 6 -keyint_min 6 -sc_threshold 0 \
  -vf "fps=25,scale=1920:-2" \
  -an -movflags +faststart \
  public/media/scene.mp4
```

`-g 6` at 25fps is a keyframe every 0.24s — at most six frames of decode to
reach any target. It costs roughly 40% bitrate over a default GOP. Pay it.

`-an` strips audio: the element is muted and the sound is a separate graph.
`+faststart` puts the index first so playback and seeking can begin before the
file has finished downloading.

If the scrub still feels heavy on lower-end phones, the next step is a
**scrub proxy**: the ten 2-second ranges concatenated into one 20-second
all-intra file (`-intra`, or `-g 1`), swapped in while a section is armed.
Twenty seconds of all-intra 1080p is around 40 MB — viable, and a later
optimisation rather than a launch requirement.

| | Landscape | Portrait | Full scene |
| --- | --- | --- | --- |
| Resolution | 1920×1080 | 1080×1920 | 1920×1080 |
| Frame rate | 25 | 25 | 25 |
| GOP | 6 | 6 | default |
| CRF | 21 | 21 | 20 |
| Audio | stripped | stripped | keep |
| Target | ≤ 45 MB | ≤ 45 MB | ≤ 60 MB |

25fps rather than 30 on purpose: it reads slower, and slower is the register of
the whole piece. It also means the two-second action is 50 frames — a
comfortable number for a hand to move through.

---

## Portrait is not optional

The film is cover-fitted to the viewport. On a 390×844 phone against a 16:9
film, the visible slice is `(390/844) / (16/9)` = **26% of the frame's width**.
Everything either side of a narrow central column is gone, and any mark out
there goes with it. On a 1280×800 desktop the same film shows 90% of its width.

So: shoot a 4K open-matte master with a protected 9:16 centre, deliver both
crops, and give the portrait cut its own mark positions — `u`/`v` in
`sections.js` are film coordinates, so the same numbers point at different
places in a different crop.

---

## Lighting beats resolution

In the default state the frame goes through ~59 texture taps of blur and a warm
luminance ramp. Lace texture and skin detail are simply not there until the
action clears the haze. What survives is **silhouette and warm key light**.

Light for the fogged state. The sharp state will look after itself.

---

## Audio

Two files, seamless loops, 60–90s:

- **The bed** — slow, bass-forward, sparse. It sits behind a low-pass that
  opens from 180 Hz to 18 kHz, so it needs something worth hearing at the
  bottom *and* at the top. A track that is all midrange has nothing to reveal.
- **The close layer** — breath, fabric, the room. Outside the filter, rising as
  each action completes. Record it closer than feels sensible.

If neither arrives the app synthesises its own, so the mechanic is never
silent. That is a fallback, not a plan.

---

## Shot list summary

| # | Section | Action (last 2s) | Direction | Status |
| --- | --- | --- | --- | --- |
| 1 | `robe` | Draw the robe open (7.40 → 10.0) | right | ✅ delivered, re-encoded, mark placed |
| 2 | `strap` | Slip the strap | down |
| 3 | `clasp` | Open the clasp | left |
| 4 | `lace` | Follow the lace | right |
| 5 | `silk` | Draw the silk down | down |
| 6 | `ribbon` | Pull the ribbon | right |
| 7 | `glove` | Peel the glove | down |
| 8 | `sheet` | Draw the sheet back | left |
| 9 | `lamp` | Turn the lamp down | down |
| 10 | `door` | Close the door | right |

Ten setups, one day, one room. The directions alternate on purpose — ten drags
the same way would feel like a form.
