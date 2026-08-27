# Media plan — how much footage this actually needs

Short answer: **one** video ships it, **three** launches it well, **six to nine**
makes it a campaign. All of it is one shoot day if it is planned as one.

The interesting part is not the count — it is that this build imposes four
constraints on the footage that a normal brand film does not. Getting those
wrong costs a reshoot; getting them right costs nothing.

---

## What the code consumes today

| Slot | File | Count |
| --- | --- | --- |
| The film behind the glass | `public/media/scene.mp4` | 1 |
| The bed | `public/media/track.mp3` | 1 |
| The close layer (breath, fabric, whispers) | `public/media/breath.mp3` | 1 |

Nothing else. Drop those three in and the whole experience runs.

---

## Four constraints the build puts on the shoot

### 1. The hero must be one locked-off shot

Marks (`src/lib/traces.js`) are anchored in **film coordinates** with no time
dimension: a mark placed on a clasp sits at that point of the frame for the
whole runtime. A camera move or a cut slides the frame out from under every
mark on it.

So the hero is either a **single locked-off take** — the talent moves, the
camera does not — or the marks need in/out timecodes, which is a feature to
build (see Tier C). Slow, tiny push-ins are survivable; anything more is not.

### 2. It has to loop seamlessly

`video.loop = true`, and at full reveal the loop point is completely exposed.
Either end the take where it began, or build a palindrome:

```bash
ffmpeg -i take.mov -filter_complex "[0:v]reverse[r];[0:v][r]concat=n=2:v=1" -an loop.mov
```

The palindrome doubles the runtime for free and can never seam — but it reads
as a loop if there is any directional motion in shot. Prefer a real match cut.

### 3. Short GOP, or the rewind lurches

The shuttle seeks by setting `currentTime`. Seek cost is the distance back to
the previous keyframe, so a default 2–5 second GOP makes rewinding stutter
badly. Encode with a keyframe roughly every half second.

```bash
ffmpeg -i master.mov \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -crf 21 -preset slow \
  -g 12 -keyint_min 12 -sc_threshold 0 \
  -vf "fps=25,scale=1920:-2" \
  -an -movflags +faststart \
  public/media/scene.mp4
```

`-g 12` at 25fps is a keyframe every 0.48s. It costs roughly 25–40% bitrate
over a default GOP — that is the price of the mechanic, and it is worth it.
`-an` strips the audio track: the element is muted and the sound is a separate
graph, so the bytes are pure waste.

### 4. Landscape footage loses most of its width on a phone

The film is cover-fitted. On a 390×844 phone against a 16:9 film, the visible
slice is `(390/844) / (16/9)` = **26% of the frame's width**. Everything either
side of a narrow central column is gone, and any mark out there goes with it.

On a 1280×800 desktop the same film shows 90% of its width. So landscape is
fine on desktop and close to unusable on mobile. This is what makes the second
render a launch requirement rather than a nice-to-have.

Shoot a 4K open-matte master with a protected 9:16 centre, and deliver both
crops from it.

---

## Tiers

### Tier A — minimum, ships today: **1 video**

One locked-off take, 30–45s, seamless, 1920×1080.

No code changes. Weakness is mobile, per constraint 4.

### Tier B — recommended launch: **3 videos**

1. **Hero, landscape** — 1920×1080, locked off, 30–45s, seamless.
2. **Hero, portrait** — 1080×1920, same take reframed from the 4K master.
3. **The full scene** — whatever the film wants to be, 60–120s. Plays in an
   ordinary player behind *Watch the full scene*: no shader, no marks, none of
   the constraints above.

Code: pick the source by viewport aspect, and a second `TRACES` set positioned
for the portrait crop. Roughly half a day.

### Tier C — full campaign: **6–9 videos**

- **3 hero loops**, one per look, each locked off and seamless. The shuttle
  browses within a look; a switcher moves between them.
- **3 product macros**, 3–5s each, silent, tight on the garment — one per mark.
  These play *inside the label* when a mark opens, which is the moment the
  piece is actually being sold.
- **1 full scene**, as Tier B.
- **1–2 social cutdowns**, 9:16, for paid — same shoot, no extra setup.

Code: marks gain in/out timecodes, labels gain a video slot, and preloading
needs a strategy so nine files do not all land at once. Two to three days.

---

## Encoding and weight

| | Landscape | Portrait | Macro | Full scene |
| --- | --- | --- | --- | --- |
| Resolution | 1920×1080 | 1080×1920 | 1280×720 | 1920×1080 |
| Frame rate | 25 | 25 | 25 | 25 |
| GOP | 12 | 12 | 12 | default |
| CRF | 21 | 21 | 20 | 20 |
| Audio | stripped | stripped | stripped | keep |
| Target | ≤ 25 MB | ≤ 25 MB | ≤ 3 MB | ≤ 60 MB |

25fps over 30 on purpose: it reads slower, and slower is the whole register of
the piece.

Resolution matters less than it looks like it should. In the default state the
frame goes through ~59 texture taps of blur and a luminance ramp — lace texture
and skin detail are simply not there until the glass is clear. What survives
the fog is **silhouette and warm key light**, so the lighting plan carries more
of this than the sensor does. Light for the fogged state; the sharp state will
look after itself.

---

## Runtime and the shuttle, which are the same decision

`SECONDS_PER_PX = 0.022` in `src/components/SteamPlane.jsx`: a full-width drag
across a 1280px screen travels ~28 seconds of film.

That makes **30–45s the natural loop length** — one confident sweep of the hand
covers the whole piece, which is what makes the shuttle feel like a control
rather than a scrollbar. If the hero comes back at 90s, raise the constant to
about `duration / 1300` so one sweep still spans it.

---

## Audio

Two files, both seamless loops, both about 60–90s:

- **The bed** — slow, bass-forward, sparse. It lives behind a low-pass that
  opens from 180 Hz to 18 kHz, so it must have something worth hearing at the
  bottom *and* at the top. A track that is all midrange has nothing to reveal.
- **The close layer** — breath, fabric, the room. Sits outside the filter and
  rises on reveal. Record it closer than feels sensible.

If neither arrives, the app synthesises its own bed and breath, so the mechanic
is never silent — but that is a fallback, not a plan.
