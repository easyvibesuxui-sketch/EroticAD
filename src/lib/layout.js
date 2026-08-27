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
