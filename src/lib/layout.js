/**
 * The film is cover-fitted to the viewport, so a point on the body is not a
 * point on the screen. Hotspots are authored in *film* coordinates (0..1 over
 * the frame) and mapped through the same cover transform the shader uses, so a
 * marker stays on the clasp it was placed on at any window shape.
 */
export function coverRect(vw, vh, texAspect) {
  const planeAspect = vw / Math.max(vh, 1)
  if (planeAspect > texAspect) {
    const h = vw / texAspect
    return { x: 0, y: (vh - h) / 2, w: vw, h }
  }
  const w = vh * texAspect
  return { x: (vw - w) / 2, y: 0, w, h: vh }
}

/** Film coordinates -> screen pixels. */
export function filmToScreen(u, v, vw, vh, texAspect) {
  const r = coverRect(vw, vh, texAspect)
  return { x: r.x + u * r.w, y: r.y + v * r.h }
}

/** Unit vector for a guide direction. Screen space, y down. */
export const DIRECTIONS = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
}

export const DIRECTION_ANGLE = { right: 0, down: 90, left: 180, up: -90 }

/**
 * A zigzag route.
 *
 * Points are local to the mark's origin — the film hotspot — so the same list
 * draws the guide and answers the hand. `dir` is the way the route travels
 * overall; the teeth swing either side of that line.
 *
 * The first and last points sit on the axis rather than at a swing, so the
 * route starts and finishes where it says it does.
 */
export function zigzagPoints({ dir = 'right', span = 320, amplitude = 40, teeth = 4 }) {
  const [dx, dy] = DIRECTIONS[dir] ?? DIRECTIONS.right
  const px = -dy
  const py = dx
  const pts = []
  for (let i = 0; i <= teeth; i += 1) {
    const along = (span * i) / teeth
    const swing = i === 0 || i === teeth ? 0 : (i % 2 === 1 ? 1 : -1) * amplitude
    pts.push({ x: dx * along + px * swing, y: dy * along + py * swing })
  }
  return pts
}

/** Running distance to each vertex, and the total. */
export function pathMetrics(pts) {
  const cum = [0]
  for (let i = 1; i < pts.length; i += 1) {
    const dx = pts[i].x - pts[i - 1].x
    const dy = pts[i].y - pts[i - 1].y
    cum.push(cum[i - 1] + Math.hypot(dx, dy))
  }
  return { cum, length: cum[cum.length - 1] }
}

/**
 * The point on the route nearest (x, y), as a distance along it and how far
 * off the route the hand actually is. The distance is what drives the film;
 * the offset is what decides whether the hand is on the route at all.
 */
export function nearestOnPath(pts, cum, x, y) {
  let bestSq = Infinity
  let bestS = 0
  for (let i = 0; i < pts.length - 1; i += 1) {
    const ax = pts[i].x
    const ay = pts[i].y
    const vx = pts[i + 1].x - ax
    const vy = pts[i + 1].y - ay
    const len2 = vx * vx + vy * vy
    let t = len2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const cx = ax + vx * t
    const cy = ay + vy * t
    const ox = x - cx
    const oy = y - cy
    const sq = ox * ox + oy * oy
    if (sq < bestSq) {
      bestSq = sq
      bestS = cum[i] + Math.sqrt(len2) * t
    }
  }
  return { s: bestS, off: Math.sqrt(bestSq) }
}

/** Where a given distance along the route falls, and which way it points there. */
export function pointAtDistance(pts, cum, s) {
  const total = cum[cum.length - 1]
  const at = Math.max(0, Math.min(total, s))
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < at) i += 1
  const seg = cum[i + 1] - cum[i]
  const t = seg > 0 ? (at - cum[i]) / seg : 0
  const ax = pts[i].x
  const ay = pts[i].y
  const vx = pts[i + 1].x - ax
  const vy = pts[i + 1].y - ay
  return {
    x: ax + vx * t,
    y: ay + vy * t,
    angle: (Math.atan2(vy, vx) * 180) / Math.PI,
  }
}
