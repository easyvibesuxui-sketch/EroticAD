import { asset } from './asset.js'

/**
 * The film, cut into ten.
 *
 * One continuous piece of footage. Each section owns eight seconds of it:
 * six that play themselves, and two the hand has to turn.
 *
 *   start ──── 6s autoplay ────▶ hold ──── 2s, mechanical ────▶ resolved
 *
 * Those last two seconds are never played. They are scrubbed: pointer travel
 * along the dashes maps straight onto the playhead, frame for frame, and
 * dragging back winds them off again. The gesture *is* the edit.
 *
 * `u`/`v` are film coordinates (0..1 across the frame, not the viewport), so an
 * indicator stays on the thing it belongs to at any window shape. `dir` is the
 * direction the hand travels, which is also the direction the dashes point and
 * the direction the action reads in the footage.
 */

/** Seconds of a section that play on their own, unless it says otherwise. */
export const AUTOPLAY_SECONDS = 8

/** Seconds at the end of a section that only the hand can move. */
export const SCRUB_SECONDS = 2

export const SECTION_SECONDS = AUTOPLAY_SECONDS + SCRUB_SECONDS

/** Past this, releasing settles the action open instead of winding it back. */
export const COMMIT_THRESHOLD = 0.82

/**
 * A section is delivered as two files: the approach, which plays itself, and
 * the action, which only the hand moves. That split is the whole timing model —
 * there is no "hold at 7.4 seconds" to get wrong, because the approach simply
 * ends and the action clip is the last two seconds. It also lets the two be
 * encoded for what they each do: the approach is never seeked, while the action
 * is nothing but seeking, so it ships all-intra.
 *
 * Without a pair, a section falls back to a shared cut or the stand-in, where
 * its slot is still described by the numbers below.
 */
const section = (i, rest) => {
  const autoplay = rest.autoplay ?? AUTOPLAY_SECONDS
  const scrub = rest.scrub ?? SCRUB_SECONDS
  const sharedStart = i * SECTION_SECONDS
  const base = {
    index: i,
    /** Drag distance as a fraction of the viewport's shorter side. */
    travel: 0.5,
    steam: 0.2,
    ...rest,
  }

  /*
   * A section is a *sequence* of actions, not one action.
   *
   * Most are a sequence of one — a single clip, drawn along a straight line —
   * and are written that way, with `action` and the section's own `u`/`v`/`dir`.
   * A section that needs more says so with `steps`, and each entry inherits
   * whatever it does not override. Finishing one step hands the film to the
   * next; winding the first one back past its start hands it back again.
   */
  const steps = (base.steps ?? [{ src: base.action }]).map((step, n) => ({
    /*
     * 'line' is a straight pull, 'ring' a turn about a centre, 'zigzag' a
     * route the hand has to trace. A section that says nothing means a line.
     */
    track: base.track ?? 'line',
    u: base.u,
    v: base.v,
    dir: base.dir ?? 'right',
    travel: base.travel,
    span: base.span,
    amplitude: base.amplitude,
    teeth: base.teeth,
    label: base.actionLabel,
    ...step,
    n,
  }))

  return {
    ...base,
    steps,
    // A slot in the shared cut, or in the procedural stand-in.
    sharedStart,
    sharedAutoplayEnd: sharedStart + autoplay,
    sharedScrubEnd: sharedStart + autoplay + scrub,
  }
}

/**
 * A single-file build has no `/media/` to serve from, so it injects each clip
 * as a data URI keyed by section id. Absent — the normal, served case — the
 * paths below are used unchanged.
 */
const injectedSections =
  (typeof window !== 'undefined' && window.__EROTICAD_MEDIA?.sections) || {}

const withInjected = (list) =>
  list.map((s) => ({
    ...s,
    approach: asset(injectedSections[`${s.id}:approach`] ?? s.approach),
    steps: s.steps.map((step) => ({
      ...step,
      src: asset(injectedSections[`${s.id}:step:${step.n}`] ?? step.src),
    })),
  }))

/*
 * The shop.
 *
 * Each section is one piece of the collection: the film shows it coming off,
 * and the card that follows sells it. Only section one is real — the other nine
 * carry placeholder pieces so the layout can be judged, and are replaced as
 * their footage arrives.
 */
export const SECTIONS = withInjected([
  section(0, {
    id: 'robe',
    product: {
      name: 'Le Peignoir',
      price: 680,
      note: 'Bias-cut silk charmeuse, hand-rolled hems',
      edition: 'One of forty',
    },
    // Two files, so the hold needs no timing at all: the approach ends where it
    // ends, and everything in the action clip belongs to the hand.
    approach: '/media/sections/01a-approach.mp4',
    action: '/media/sections/01b-action.mp4',
    actionLabel: 'Draw the robe open',
    title: 'One',
    caption: 'It was never really closed.',
    /*
     * Measured off the action clip's first frame. Both hands hold the robe at
     * v 0.36 — the near one at u 0.31, the far one at u 0.68 — and over the next
     * two and a half seconds they travel apart and out of frame. Outward, not
     * downward. A straight drag can only follow one hand, so it follows the far
     * one to the right: forward opens the robe, back closes it.
     */
    u: 0.68,
    v: 0.36,
    dir: 'right',
    // A long, deliberate pull: the action clip runs two and a half seconds, and
    // it should take about that long to draw it through by hand.
    travel: 0.58,
    // Tuned against the delivered footage rather than guessed at: 0.34 was set
    // before there was a film to look at, and it fogged this one past reading.
    steam: 0.22,
  }),

  section(1, {
    id: 'strap',
    product: {
      name: 'La Combinaison',
      price: 420,
      note: 'Washed silk, French seams throughout',
      edition: 'One of sixty',
    },
    title: 'Two',
    caption: 'Silk charmeuse, cut on the bias.',
    approach: '/media/sections/02a-approach.mp4',
    /*
     * Two actions, not one, and neither of them a straight pull.
     *
     * Both hands take the lace and roll it down, and a roll is a turn — so the
     * guide is a circle and the hand goes round it. The clips are consecutive:
     * the second one's first frame and the first one's last differ by 0.36 of
     * a grey level out of 255, so the handover between them is invisible.
     *
     * The second ring is the first one turned over — it starts where the first
     * finished and runs back the other way, because that is what the second
     * half of the movement does. Winding it back past its own start returns
     * the film to the first ring, fully wound, so nothing here is one-way.
     *
     * Centred between the two hands, measured off the action clip's first
     * frame: the near hand sits at u 0.34, the far one at u 0.47, both at
     * about v 0.77.
     */
    u: 0.4,
    v: 0.74,
    steps: [
      {
        src: '/media/sections/02b-action.mp4',
        track: 'ring',
        label: 'Turn the lace down',
        /** Radius as a fraction of the viewport's shorter side. */
        radius: 0.15,
        /** Degrees of arc the whole action occupies. */
        sweep: 250,
        /** Where the hand starts, in degrees. 0 is three o'clock, y down. */
        start: -140,
        /** +1 turns clockwise, -1 anticlockwise. */
        spin: 1,
      },
      {
        src: '/media/sections/02c-action.mp4',
        track: 'ring',
        label: 'Keep turning',
        radius: 0.15,
        sweep: 250,
        // The same ring, turned over: it picks up where the first one left off
        // and runs the other way.
        start: 40,
        spin: -1,
      },
    ],
    steam: 0.2,
  }),
  section(2, {
    id: 'maillot',
    product: {
      name: 'Le Maillot',
      price: 390,
      note: 'Matte jersey, fully lined, seams closed by hand',
      edition: 'One of thirty',
    },
    title: 'Three',
    caption: 'It opens crosswise.',
    approach: '/media/sections/03a-approach.mp4',
    /*
     * One action, drawn along a line, because that is what the movement is:
     * the whole three seconds open sideways. No ring here — the guide is the
     * shape of the thing it is guiding, and this one is not a turn.
     *
     * Two things travel and they travel apart, so a straight drag can only
     * follow one of them, the same bargain section one makes. It follows the
     * knee on the right, measured off the action clip: u 0.63 at the first
     * frame and u 0.75 by the last, with the foot carrying on out to 0.88.
     * The mark starts a little inboard of that, at u 0.60, to keep it on
     * screen when a portrait phone crops the frame to its middle.
     */
    action: '/media/sections/03b-action.mp4',
    actionLabel: 'Open her',
    u: 0.6,
    v: 0.42,
    dir: 'right',
    // Three and a fifth seconds of film, against section one's two and a half:
    // a longer pull, so it takes about as long to draw through as it runs.
    travel: 0.7,
  }),
  section(3, {
    id: 'chambre',
    product: {
      name: 'La Robe de Chambre',
      price: 540,
      note: 'Washed silk crepe, wrapped and tied, no fastening',
      edition: 'One of twenty',
    },
    title: 'Four',
    caption: 'It was only ever resting there.',
    approach: '/media/sections/04a-approach.mp4',
    /*
     * The second robe in the collection, and the only action so far that goes
     * straight down: the wrap is pushed off the hips from behind and leaves the
     * frame at the bottom.
     *
     * Measured off the action clip. The fabric's top edge lies across the hips
     * at v 0.63 in the first frame and is gone by the last. The mark sits a
     * little above it at v 0.60, which costs nothing in accuracy — the edge is
     * a hand's width of cloth, not a point — and buys thirty pixels of travel
     * before the bottom of the window cuts it off.
     *
     * u 0.5 is the best placement this film has had: dead centre horizontally,
     * which is the one column a portrait phone is guaranteed to show.
     */
    action: '/media/sections/04b-action.mp4',
    actionLabel: 'Push it down',
    u: 0.5,
    v: 0.6,
    dir: 'down',
    travel: 0.5,
    steam: 0.26,
  }),
  section(4, {
    id: 'culotte',
    product: {
      name: 'La Culotte',
      price: 180,
      note: 'Cotton jersey, bonded edges, no seams anywhere',
      edition: 'One of eighty',
    },
    title: 'Five',
    caption: 'It only took one hand.',
    approach: '/media/sections/05a-approach.mp4',
    /*
     * This one was shot in portrait, 720x1280, where every other clip is
     * 1280x720. The code needed nothing for that — the stage cover-fits
     * whatever aspect the current clip reports — but the framing did: a
     * landscape window can only show a band across a portrait frame's middle,
     * v 0.32 to 0.68 at 1280x800, and the action ran from v 0.66 to 0.88. The
     * hand left the visible band a third of the way through the pull.
     *
     * So both clips are cut to 16:9 around the action: a 720x405 window at
     * y 790, upscaled to 1280x720.
     *
     * The approach could not take that window fixed. It is a different shot —
     * she is at the basin, drinking from the tap, and the hips only matter in
     * its last half-second — so a hip-level crop would have thrown away all
     * seven seconds of it. Its window drifts instead, from head-and-chest down
     * to exactly the window the action holds, arriving there as the clip ends.
     * It reads as a slow push down rather than as a crop, and it keeps the cut
     * between the two clips invisible, which is the whole point of the pair.
     *
     * Measured off the cut action clip: the grip starts at u 0.36, v 0.125 and
     * carries down to v 0.76 — 0.635 of the frame's height. The mark sits just
     * above it, and travel is set so the ring finishes about where the hand
     * does rather than short of it.
     */
    action: '/media/sections/05b-action.mp4',
    actionLabel: 'Take them down',
    u: 0.36,
    v: 0.11,
    dir: 'down',
    travel: 0.55,
    steam: 0.3,
  }),
  section(5, {
    id: 'tanga',
    product: {
      name: 'Le Tanga',
      price: 210,
      note: 'Leavers lace, scalloped edge, no elastic anywhere',
      edition: 'One of ninety',
    },
    title: 'Six',
    caption: 'Two hands, and no hurry.',
    approach: '/media/sections/06a-approach.mp4',
    /*
     * The only section whose action runs longer than its approach: 4.63s of
     * film that plays itself against 5.38s that the hand has to turn. Nothing
     * needed changing for that — the approach ends when it ends — but it does
     * mean the longest, slowest pull in the collection, which suits what it is.
     *
     * Two hands take the lace down together, so unlike section one there is no
     * choosing between them: they move as one and the guide follows the
     * garment rather than a hand. Measured off the action clip, the waistband
     * lies at u 0.43, v 0.54 in the first frame and v 0.83 in the last.
     */
    action: '/media/sections/06b-action.mp4',
    actionLabel: 'Ease them down',
    u: 0.43,
    v: 0.52,
    dir: 'down',
    // Asked for long and clamped to whatever the window can give: five and a
    // half seconds of film should not go past under a flick of the wrist.
    travel: 0.75,
  }),
  section(6, {
    id: 'chaine',
    product: {
      name: 'La Chaîne',
      price: 460,
      note: 'Silver chain over a bare cup, hooked at the spine',
      edition: 'One of twenty-five',
    },
    title: 'Seven',
    caption: 'She stopped for the water, not for you.',
    approach: '/media/sections/07a-approach.mp4',
    /*
     * Neither a pull nor a turn. She is at a drinking fountain with her tongue
     * out to the stream, and the movement is back and forth — so the guide is
     * a zigzag and the hand has to make the same shape.
     *
     * It is a route, not a decoration: `usePathDrag` only advances while the
     * hand is inside a corridor around the line, so cutting the corners moves
     * nothing. The film answers to distance travelled along the polyline.
     *
     * Measured off the action clip: the tongue is at u 0.75, v 0.54 in the
     * first frame and has drawn back to u 0.70 by the last. The route starts
     * at the tongue and runs left, the way the head goes.
     */
    action: '/media/sections/07b-action.mp4',
    actionLabel: 'Follow her tongue',
    track: 'zigzag',
    u: 0.75,
    v: 0.54,
    dir: 'left',
    /** Length of the route's axis, as a fraction of the shorter side. */
    span: 0.42,
    /** How far the teeth swing either side of it. */
    amplitude: 0.055,
    teeth: 4,
    steam: 0.2,
  }),
  section(7, {
    id: 'sheet',
    product: {
      name: 'Le Drap',
      price: 610,
      note: 'Stonewashed linen, ladder-stitched',
      edition: 'One of thirty',
    },
    actionLabel: 'Draw the sheet back',
    title: 'Eight',
    caption: 'Washed linen, heavy as water.',
    u: 0.55,
    v: 0.62,
    dir: 'left',
    steam: 0.3,
  }),
  section(8, {
    id: 'lamp',
    product: {
      name: 'La Veilleuse',
      price: 340,
      note: 'Hand-blown glass on an aged brass base',
      edition: 'One of twenty',
    },
    actionLabel: 'Turn the lamp down',
    title: 'Nine',
    caption: 'The room goes the colour of skin.',
    u: 0.28,
    v: 0.36,
    dir: 'down',
  }),
  section(9, {
    id: 'door',
    product: {
      name: 'La Clé',
      price: 120,
      note: 'Solid brass, engraved to order',
      edition: 'One of ten',
    },
    actionLabel: 'Close the door',
    title: 'Ten',
    caption: 'Everything after this is yours.',
    u: 0.5,
    v: 0.5,
    dir: 'right',
    steam: 0.4,
  }),
])

export const FILM_SECONDS = SECTIONS.length * SECTION_SECONDS
