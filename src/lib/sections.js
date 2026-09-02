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
 * A section may carry its own clip (`src`), which is how the film is actually
 * being delivered — one file per setup. Then its timings are measured from the
 * start of that file. Without one it falls back to the shared cut, or to the
 * stand-in, and its timings are measured from its slot in that longer piece.
 * Both sets are computed here; the source that resolves at runtime decides
 * which pair is used.
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
    autoplay,
    scrub,
    // Its own clip: the section is the whole file.
    ownStart: 0,
    ownAutoplayEnd: autoplay,
    ownScrubEnd: autoplay + scrub,
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
  list.map((s) => (s.src && injectedSections[s.id] ? { ...s, src: injectedSections[s.id] } : s))

export const SECTIONS = withInjected([
  section(0, {
    id: 'robe',
    src: '/media/sections/01-robe.mp4',
    autoplay: 8,
    scrub: 2,
    action: 'Draw the robe open',
    title: 'One',
    caption: 'It was never really closed.',
    // Measured off the clip, not guessed: at the eighth second the near hand
    // grips the robe here, and over the next two seconds it travels down and
    // out. Down is the dominant axis by more than two to one, so that is the
    // axis the drag reads.
    u: 0.23,
    v: 0.38,
    dir: 'down',
    length: 220,
    // Tuned against the delivered footage rather than guessed at: 0.34 was set
    // before there was a film to look at, and it fogged this one past reading.
    steam: 0.22,
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
])

export const FILM_SECONDS = SECTIONS.length * SECTION_SECONDS
