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
  return {
    index: i,
    length: 96,
    steam: 0.2,
    ...rest,
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
    ...(injectedSections[`${s.id}:approach`] ? { approach: injectedSections[`${s.id}:approach`] } : {}),
    ...(injectedSections[`${s.id}:action`] ? { action: injectedSections[`${s.id}:action`] } : {}),
  }))

export const SECTIONS = withInjected([
  section(0, {
    id: 'robe',
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
    length: 250,
    // Tuned against the delivered footage rather than guessed at: 0.34 was set
    // before there was a film to look at, and it fogged this one past reading.
    steam: 0.22,
  }),

  section(1, {
    id: 'strap',
    actionLabel: 'Slip the strap',
    title: 'Two',
    caption: 'Silk charmeuse, cut on the bias.',
    u: 0.42,
    v: 0.3,
    dir: 'down',
    length: 108,
  }),
  section(2, {
    id: 'clasp',
    actionLabel: 'Open the clasp',
    title: 'Three',
    caption: 'Solid brass, aged by hand.',
    u: 0.58,
    v: 0.46,
    dir: 'left',
    length: 84,
  }),
  section(3, {
    id: 'lace',
    actionLabel: 'Follow the lace',
    title: 'Four',
    caption: 'Leavers lace from Calais.',
    u: 0.36,
    v: 0.55,
    dir: 'right',
    steam: 0.26,
  }),
  section(4, {
    id: 'silk',
    actionLabel: 'Draw the silk down',
    title: 'Five',
    caption: 'Nothing under it but the light.',
    u: 0.5,
    v: 0.4,
    dir: 'down',
    length: 116,
    steam: 0.3,
  }),
  section(5, {
    id: 'ribbon',
    actionLabel: 'Pull the ribbon',
    title: 'Six',
    caption: 'It only ever held by one knot.',
    u: 0.46,
    v: 0.52,
    dir: 'right',
    length: 120,
  }),
  section(6, {
    id: 'glove',
    actionLabel: 'Peel the glove',
    title: 'Seven',
    caption: 'Elbow length, seamed at the wrist.',
    u: 0.62,
    v: 0.44,
    dir: 'down',
    length: 104,
  }),
  section(7, {
    id: 'sheet',
    actionLabel: 'Draw the sheet back',
    title: 'Eight',
    caption: 'Washed linen, heavy as water.',
    u: 0.55,
    v: 0.62,
    dir: 'left',
    length: 112,
    steam: 0.3,
  }),
  section(8, {
    id: 'lamp',
    actionLabel: 'Turn the lamp down',
    title: 'Nine',
    caption: 'The room goes the colour of skin.',
    u: 0.28,
    v: 0.36,
    dir: 'down',
    length: 88,
  }),
  section(9, {
    id: 'door',
    actionLabel: 'Close the door',
    title: 'Ten',
    caption: 'Everything after this is yours.',
    u: 0.5,
    v: 0.5,
    dir: 'right',
    length: 128,
    steam: 0.4,
  }),
])

export const FILM_SECONDS = SECTIONS.length * SECTION_SECONDS
