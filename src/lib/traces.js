/**
 * Traces — the gold marks on the film.
 *
 * `pull`  a ring with a chevron and a dashed path. Drag the ring along the
 *         dashes to the terminus and it opens. This is the reference gesture:
 *         the mark tells you which way the hand should move.
 * `dwell` a bare dot inside a dashed circle. Rest on it and the circle closes.
 *
 * Coordinates are in film space (0..1 across the frame, not the viewport), so
 * a mark stays put on the body when the window changes shape. Re-author these
 * against the real cut — they are the only thing here that is content-specific.
 */
export const TRACES = [
  {
    id: 'slip',
    kind: 'pull',
    u: 0.5,
    v: 0.3,
    dir: 'down',
    length: 84,
    label: 'The silk slip',
    meta: 'Bias-cut charmeuse · 240',
  },
  {
    id: 'clasp',
    kind: 'pull',
    u: 0.28,
    v: 0.52,
    dir: 'left',
    length: 66,
    label: 'Hand-set clasp',
    meta: 'Solid brass, aged · 90',
  },
  {
    id: 'lace',
    kind: 'dwell',
    u: 0.72,
    v: 0.6,
    label: 'French lace',
    meta: 'Calais leavers · 180',
  },
]

/** How far the ring has to travel, as a fraction of the path, to open. */
export const PULL_THRESHOLD = 0.82

/** How long a dwell has to hold, in seconds. */
export const DWELL_SECONDS = 1.1

/** Screen radius within which a mark takes the hand. */
export const ARM_RADIUS = 96
