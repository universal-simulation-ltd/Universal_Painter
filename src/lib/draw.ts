// How each tool puts paint on a canvas. Called with picture coordinates.
import type { Rect } from './pixels'
import type { ShapeStyle } from '../stores/paintStore'

/**
 * The pencil: hard-edged, no smoothing, the way Paint's pencil draws. Squares
 * of `size` stamped along a Bresenham line between whole pixels, so a 1-pixel
 * pencil makes a true 1-pixel line with no grey fringe. Returns the box drawn.
 */
export function pencilLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, size: number, color: string): Rect {
  ctx.fillStyle = color
  let ax = Math.floor(x0), ay = Math.floor(y0)
  const bx = Math.floor(x1), by = Math.floor(y1)
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay)
  const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1
  let err = dx + dy
  const half = Math.floor(size / 2)
  for (;;) {
    ctx.fillRect(ax - half, ay - half, size, size)
    if (ax === bx && ay === by) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; ax += sx }
    if (e2 <= dx) { err += dx; ay += sy }
  }
  return pad(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), size)
}

/**
 * The brush (and the eraser): soft-edged and round. Each segment is its own
 * stroke so the width can follow pen pressure; round caps hide the joins.
 */
export function brushLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  width: number, color: string, erase: boolean,
): Rect {
  ctx.save()
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
  ctx.strokeStyle = erase ? '#000' : color
  ctx.fillStyle = erase ? '#000' : color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(0.5, width)
  if (x0 === x1 && y0 === y1) {
    // A tap is a dot, not nothing.
    ctx.beginPath()
    ctx.arc(x0, y0, Math.max(0.5, width / 2), 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  ctx.restore()
  return pad(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), width)
}

export interface ShapeInk {
  primary: string
  secondary: string
  width: number
  style: ShapeStyle
}

export function drawLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, ink: ShapeInk): Rect {
  ctx.save()
  ctx.strokeStyle = ink.primary
  ctx.lineWidth = ink.width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.restore()
  return pad(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), ink.width)
}

/** A box or an ellipse inside `r`. Outline in the first colour; fill in the second when outlined, else the first. */
export function drawShape(ctx: CanvasRenderingContext2D, kind: 'box' | 'ellipse', r: Rect, ink: ShapeInk): Rect {
  const w = ink.width
  ctx.save()
  ctx.lineWidth = w
  ctx.lineJoin = kind === 'box' ? 'miter' : 'round'
  ctx.beginPath()
  // The outline is drawn INSIDE the dragged box, so the shape ends where the
  // pointer stopped rather than half a line width beyond it.
  const inset = ink.style === 'fill' ? 0 : w / 2
  const x = r.x + inset, y = r.y + inset
  const rw = Math.max(0, r.width - inset * 2), rh = Math.max(0, r.height - inset * 2)
  if (kind === 'box') ctx.rect(x, y, rw, rh)
  else ctx.ellipse(x + rw / 2, y + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2)
  if (ink.style !== 'outline') {
    ctx.fillStyle = ink.style === 'both' ? ink.secondary : ink.primary
    ctx.fill()
  }
  if (ink.style !== 'fill') {
    ctx.strokeStyle = ink.primary
    ctx.stroke()
  }
  ctx.restore()
  return pad(r.x, r.y, r.width, r.height, 2)
}

export function fontFor(size: number, bold: boolean): string {
  return `${bold ? '700' : '400'} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
}

/** The line height text is set at, both in the box being typed in and on the canvas. */
export const LINE_HEIGHT = 1.25

/** Text, one line per line of the box, top-left at (x, y). */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bold: boolean, color: string): Rect {
  ctx.save()
  ctx.font = fontFor(size, bold)
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  const lines = text.split('\n')
  let widest = 0
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * size * LINE_HEIGHT + (size * (LINE_HEIGHT - 1)) / 2)
    widest = Math.max(widest, ctx.measureText(line).width)
  })
  ctx.restore()
  return pad(x, y, widest, lines.length * size * LINE_HEIGHT, size / 2)
}

function pad(x: number, y: number, w: number, h: number, by: number): Rect {
  const p = Math.ceil(by / 2) + 2
  return { x: Math.floor(x - p), y: Math.floor(y - p), width: Math.ceil(w + p * 2) + 1, height: Math.ceil(h + p * 2) + 1 }
}
