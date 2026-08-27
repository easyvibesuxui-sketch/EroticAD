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

/** Seconds of each section that play on their own. */
export const AUTOPLAY_SECONDS = 6

/** Seconds at the end of each section that only the hand can move. */
export const SCRUB_SECONDS = 2

export const SECTION_SECONDS = AUTOPLAY_SECONDS + SCRUB_SECONDS

/** Past this, releasing settles the action open instead of winding it back. */
export const COMMIT_THRESHOLD = 0.82

const section = (i, rest) => ({
  index: i,
  start: i * SECTION_SECONDS,
  autoplayEnd: i * SECTION_SECONDS + AUTOPLAY_SECONDS,
  scrubEnd: (i + 1) * SECTION_SECONDS,
  length: 96,
  steam: 0.2,
  ...rest,
})

export const SECTIONS = [
  section(0, {
    id: 'hair',
    action: 'Sweep the hair aside',
    title: 'One',
    caption: 'She has not decided yet.',
    u: 0.52,
    v: 0.34,
    dir: 'right',
    steam: 0.34,
  }),
  section(1, {
    id: 'strap',
    action: 'Slip the strap',
    title: 'Two',
    caption: 'Silk charmeuse, cut on the bias.',
    u: 0.42,
    v: 0.3,
    dir: 'down',
    length: 108,
  }),
  section(2, {
    id: 'clasp',
    action: 'Open the clasp',
    title: 'Three',
    caption: 'Solid brass, aged by hand.',
    u: 0.58,
    v: 0.46,
    dir: 'left',
    length: 84,
  }),
  section(3, {
    id: 'lace',
    action: 'Follow the lace',
    title: 'Four',
    caption: 'Leavers lace from Calais.',
    u: 0.36,
    v: 0.55,
    dir: 'right',
    steam: 0.26,
  }),
  section(4, {
    id: 'silk',
    action: 'Draw the silk down',
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
    action: 'Pull the ribbon',
    title: 'Six',
    caption: 'It only ever held by one knot.',
    u: 0.46,
    v: 0.52,
    dir: 'right',
    length: 120,
  }),
  section(6, {
    id: 'glove',
    action: 'Peel the glove',
    title: 'Seven',
    caption: 'Elbow length, seamed at the wrist.',
    u: 0.62,
    v: 0.44,
    dir: 'down',
    length: 104,
  }),
  section(7, {
    id: 'sheet',
    action: 'Draw the sheet back',
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
    action: 'Turn the lamp down',
    title: 'Nine',
    caption: 'The room goes the colour of skin.',
    u: 0.28,
    v: 0.36,
    dir: 'down',
    length: 88,
  }),
  section(9, {
    id: 'door',
    action: 'Close the door',
    title: 'Ten',
    caption: 'Everything after this is yours.',
    u: 0.5,
    v: 0.5,
    dir: 'right',
    length: 128,
    steam: 0.4,
  }),
]

export const FILM_SECONDS = SECTIONS.length * SECTION_SECONDS
