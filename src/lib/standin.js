/**
 * Stand-in footage.
 *
 * When no video loads we still need something warm and moving under the
 * shader, or there is nothing to tease. This paints a body in candlelight:
 * abstract, slow, lit from one side — enough for the condensation, the skin
 * bleed and the reveal curve to be judged honestly without any asset.
 */
export function createStandIn(width = 640, height = 360) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  const draw = (t) => {
    const { width: w, height: h } = canvas

    ctx.fillStyle = '#06030a'
    ctx.fillRect(0, 0, w, h)

    // Candle, drifting.
    const lx = w * (0.34 + 0.05 * Math.sin(t * 0.21))
    const ly = h * (0.28 + 0.04 * Math.cos(t * 0.17))
    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, h * 1.15)
    glow.addColorStop(0, 'rgba(255, 206, 168, 0.95)')
    glow.addColorStop(0.28, 'rgba(214, 120, 100, 0.52)')
    glow.addColorStop(0.62, 'rgba(112, 32, 46, 0.30)')
    glow.addColorStop(1, 'rgba(6, 3, 10, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    // A shoulder and a hip, breathing.
    ctx.save()
    ctx.translate(w * 0.52, h * 0.62)
    const breathe = 1 + 0.02 * Math.sin(t * 0.8)
    ctx.scale(breathe, 1 / breathe)

    const body = ctx.createLinearGradient(-w * 0.3, -h * 0.5, w * 0.25, h * 0.5)
    body.addColorStop(0, 'rgba(240, 186, 156, 0.92)')
    body.addColorStop(0.45, 'rgba(168, 96, 84, 0.75)')
    body.addColorStop(1, 'rgba(28, 8, 16, 0.85)')
    ctx.fillStyle = body

    ctx.beginPath()
    ctx.moveTo(-w * 0.30, h * 0.42)
    ctx.bezierCurveTo(
      -w * 0.26, -h * 0.10 + 12 * Math.sin(t * 0.5),
      -w * 0.02, -h * 0.44,
      w * 0.10, -h * 0.30 + 10 * Math.cos(t * 0.43),
    )
    ctx.bezierCurveTo(
      w * 0.24, -h * 0.16,
      w * 0.12, h * 0.10,
      w * 0.22, h * 0.42,
    )
    ctx.closePath()
    ctx.fill()

    // Rim light down the near edge.
    ctx.globalCompositeOperation = 'screen'
    const rim = ctx.createLinearGradient(-w * 0.32, 0, -w * 0.18, 0)
    rim.addColorStop(0, 'rgba(255, 214, 186, 0.55)')
    rim.addColorStop(1, 'rgba(255, 214, 186, 0)')
    ctx.fillStyle = rim
    ctx.fill()
    ctx.restore()

    // Sheet, low in frame.
    ctx.globalCompositeOperation = 'source-over'
    const sheet = ctx.createLinearGradient(0, h * 0.72, 0, h)
    sheet.addColorStop(0, 'rgba(12, 4, 10, 0)')
    sheet.addColorStop(1, 'rgba(46, 10, 22, 0.9)')
    ctx.fillStyle = sheet
    ctx.fillRect(0, h * 0.7, w, h * 0.3)
  }

  draw(0)
  return { canvas, draw }
}
