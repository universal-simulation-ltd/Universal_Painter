// The things placed on the picture that stay movable: boxes, ellipses, lines,
// text, pastes and QR codes (James, 2026-10-30: "allow the user to select
// individual creations e.g. boxes and move them", with corner handles to
// resize). Pencil and brush strokes, the eraser and the fill bucket are paint.
//
// Each object keeps what it IS (`source`) and where its shape sits (`inner`),
// so moving, resizing or restyling draws it again from scratch instead of
// stretching pixels: a box made bigger keeps its line width, text stays
// sharp, a paste is scaled from the original picture.
//
// There is still one canvas. An object on it also keeps a copy of its own
// pixels and of what it covered (`under`); picking it up puts `under` back.
// That only stays true while nothing has been painted over it, so the moment
// a paint edit changes any pixel of an object, it becomes plain paint (see
// PaintDoc.commit). The same rule as Paint: a shape is movable until you paint
// on it.
import { drawLine, drawShape, drawText, fontFor, LINE_HEIGHT, type ShapeInk } from './draw'
import { makeCanvas } from './imageFiles'
import type { Rect } from './pixels'

export type Source =
  | { kind: 'shape'; tool: 'box' | 'ellipse'; ink: ShapeInk }
  /** A line from one corner of `inner` to the opposite one. */
  | { kind: 'line'; ink: ShapeInk; fromRight: boolean; fromBottom: boolean }
  | { kind: 'text'; value: string; size: number; bold: boolean; colour: string }
  /** A paste, a QR code or lifted pixels: drawn from this original, so resizing never compounds. */
  | { kind: 'image'; canvas: HTMLCanvasElement }

/** Which ways an object is mirrored. */
export interface Flip { h: boolean; v: boolean }
export const NO_FLIP: Flip = { h: false, v: false }

/** An object on the canvas. Every field is fixed once made: a change makes a new one. */
export interface Item {
  source: Source
  /** The shape's own box: the dragged box, a line's two ends, the text, the picture. */
  inner: Rect
  /** Degrees it is turned clockwise about its centre (James, 2026-11-01); 0 is upright. */
  angle: number
  /** Mirrored left to right and/or top to bottom, in its own frame (before it is turned). */
  flip: Flip
  /** Where `pixels` sits on the canvas: `inner` plus room for the line width, turned by `angle`. */
  rect: Rect
  pixels: HTMLCanvasElement
  /** What the object covered when it was put down. */
  under: HTMLCanvasElement
}

/** Room round `inner` for line width, caps and soft edges (as draw.ts pads). */
export function padFor(source: Source): number {
  switch (source.kind) {
    case 'shape': return 3
    case 'line': return Math.ceil(source.ink.width / 2) + 2
    case 'text': return Math.ceil(source.size / 4) + 2
    case 'image': return 0
  }
}

export function rectFor(source: Source, inner: Rect): Rect {
  const p = padFor(source)
  const extra = source.kind === 'image' ? 0 : 1
  return { x: inner.x - p, y: inner.y - p, width: inner.width + p * 2 + extra, height: inner.height + p * 2 + extra }
}

/**
 * Draw `source` filling `inner`, turned `angle` degrees about its centre: the
 * pixels, and where they go. Turned, the pixels are the upright drawing
 * rotated into the box that holds it, so `rect` stays square to the canvas.
 */
export function render(source: Source, inner: Rect, angle = 0, flip: Flip = NO_FLIP): { canvas: HTMLCanvasElement; rect: Rect } {
  const upright = mirrored(renderUpright(source, inner), flip)
  if (!turned(angle)) return upright
  const { canvas: src, rect: r } = upright
  const a = (angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a))
  const width = Math.ceil(r.width * cos + r.height * sin) + 2
  const height = Math.ceil(r.width * sin + r.height * cos) + 2
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2
  const rect = { x: Math.round(cx - width / 2), y: Math.round(cy - height / 2), width, height }
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(cx - rect.x, cy - rect.y)
  ctx.rotate(a)
  ctx.drawImage(src, -r.width / 2, -r.height / 2)
  src.width = 0
  src.height = 0
  return { canvas, rect }
}

/** The drawing mirrored in place (the same canvas back when there is nothing to mirror). */
function mirrored(drawn: { canvas: HTMLCanvasElement; rect: Rect }, flip: Flip): { canvas: HTMLCanvasElement; rect: Rect } {
  if (!flip.h && !flip.v) return drawn
  const src = drawn.canvas
  const canvas = makeCanvas(src.width, src.height)
  const ctx = canvas.getContext('2d')!
  ctx.translate(flip.h ? src.width : 0, flip.v ? src.height : 0)
  ctx.scale(flip.h ? -1 : 1, flip.v ? -1 : 1)
  ctx.drawImage(src, 0, 0)
  src.width = 0
  src.height = 0
  return { canvas, rect: drawn.rect }
}

/**
 * The object flipped as it looks on screen. Mirroring a turned object in its
 * own frame would flip it about a tilted line, so the angle is mirrored too.
 */
export function flipped(angle: number, flip: Flip, horizontal: boolean): { angle: number; flip: Flip } {
  return {
    angle: turned(angle) ? normalAngle(-angle) : 0,
    flip: horizontal ? { ...flip, h: !flip.h } : { ...flip, v: !flip.v },
  }
}

/** Whether `angle` leaves an object turned at all. */
export function turned(angle: number): boolean {
  return Math.round(angle * 100) % 36000 !== 0
}

/** `angle` as -180 to 180, the way it is shown. */
export function normalAngle(angle: number): number {
  const a = ((angle % 360) + 360) % 360
  return a > 180 ? a - 360 : a
}

/** Turn (x, y) `angle` degrees clockwise about (cx, cy). */
export function turnPoint(x: number, y: number, cx: number, cy: number, angle: number): { x: number; y: number } {
  const a = (angle * Math.PI) / 180
  const cos = Math.cos(a), sin = Math.sin(a)
  const dx = x - cx, dy = y - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

/** The object's upright frame (`inner` plus its pad) and the centre it turns about. */
export function frameOf(source: Source, inner: Rect): { frame: Rect; cx: number; cy: number } {
  const frame = rectFor(source, inner)
  return { frame, cx: frame.x + frame.width / 2, cy: frame.y + frame.height / 2 }
}

/** The four corners of the object's frame as it sits turned: top-left, top-right, bottom-right, bottom-left. */
export function turnedCorners(source: Source, inner: Rect, angle: number): { x: number; y: number }[] {
  const { frame: f, cx, cy } = frameOf(source, inner)
  return [[f.x, f.y], [f.x + f.width, f.y], [f.x + f.width, f.y + f.height], [f.x, f.y + f.height]]
    .map(([x, y]) => turnPoint(x, y, cx, cy, angle))
}

function renderUpright(source: Source, inner: Rect): { canvas: HTMLCanvasElement; rect: Rect } {
  const rect = rectFor(source, inner)
  const canvas = makeCanvas(Math.max(1, rect.width), Math.max(1, rect.height))
  const ctx = canvas.getContext('2d')!
  const p = padFor(source)
  const local = { x: p, y: p, width: inner.width, height: inner.height }
  switch (source.kind) {
    case 'shape':
      drawShape(ctx, source.tool, local, source.ink)
      break
    case 'line': {
      const x0 = source.fromRight ? local.x + local.width : local.x
      const y0 = source.fromBottom ? local.y + local.height : local.y
      const x1 = source.fromRight ? local.x : local.x + local.width
      const y1 = source.fromBottom ? local.y : local.y + local.height
      drawLine(ctx, x0, y0, x1, y1, source.ink)
      break
    }
    case 'text':
      drawText(ctx, source.value, p, p, source.size, source.bold, source.colour)
      break
    case 'image':
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(source.canvas, 0, 0, canvas.width, canvas.height)
      break
  }
  return { canvas, rect }
}

let measurer: CanvasRenderingContext2D | null = null

/** The box text takes up with its top-left at (x, y). */
export function textInner(value: string, size: number, bold: boolean, x: number, y: number): Rect {
  measurer ??= makeCanvas(1, 1).getContext('2d')!
  measurer.font = fontFor(size, bold)
  const lines = value.split('\n')
  const widest = Math.max(...lines.map((l) => measurer!.measureText(l).width))
  return { x, y, width: Math.max(1, Math.ceil(widest)), height: Math.max(1, Math.ceil(lines.length * size * LINE_HEIGHT)) }
}

/**
 * The object's new inner box when a corner of `rect` is dragged to (px, py),
 * the opposite corner staying put. `corner` is 0 top-left, 1 top-right,
 * 2 bottom-right, 3 bottom-left. Pictures and text keep their proportions
 * (Shift lets a picture stretch); boxes, ellipses and lines go where they are
 * dragged (Shift keeps them in proportion instead, as it does when drawing).
 */
export function resized(source: Source, inner: Rect, corner: number, px: number, py: number, shift: boolean): { source: Source; inner: Rect } {
  const p = padFor(source)
  // The fixed corner of the inner box, and the dragged one (pointer minus the pad).
  const right = corner === 1 || corner === 2
  const bottom = corner === 2 || corner === 3
  const fx = right ? inner.x : inner.x + inner.width
  const fy = bottom ? inner.y : inner.y + inner.height
  let w = Math.max(1, Math.round(right ? px - p - fx : fx - (px + p)))
  let h = Math.max(1, Math.round(bottom ? py - p - fy : fy - (py + p)))
  const keep = source.kind === 'text' || (source.kind === 'image' ? !shift : shift)
  if (keep) {
    const k = Math.max(w / inner.width, h / inner.height)
    w = Math.max(1, Math.round(inner.width * k))
    h = Math.max(1, Math.round(inner.height * k))
  }
  let next = source
  if (source.kind === 'text') {
    const size = Math.max(4, Math.round(source.size * (h / inner.height)))
    next = { ...source, size }
    const box = textInner(source.value, size, source.bold, 0, 0)
    w = box.width
    h = box.height
  }
  return { source: next, inner: { x: right ? fx : fx - w, y: bottom ? fy : fy - h, width: w, height: h } }
}

/**
 * `resized` for an object turned `angle` degrees: the pointer is read in the
 * object's own upright frame, and the corner opposite the dragged one stays
 * where it is on the canvas (resizing moves the centre it turns about).
 */
export function resizedTurned(source: Source, inner: Rect, angle: number, corner: number, px: number, py: number, shift: boolean): { source: Source; inner: Rect } {
  if (!turned(angle)) return resized(source, inner, corner, px, py, shift)
  const was = frameOf(source, inner)
  const at = turnPoint(px, py, was.cx, was.cy, -angle)
  const next = resized(source, inner, corner, at.x, at.y, shift)
  // The fixed corner of the inner box, before and after, as it sits on the canvas.
  const right = corner === 1 || corner === 2
  const bottom = corner === 2 || corner === 3
  const fixed = (r: Rect) => ({ x: right ? r.x : r.x + r.width, y: bottom ? r.y : r.y + r.height })
  const a = fixed(inner), b = fixed(next.inner)
  const now = frameOf(next.source, next.inner)
  const before = turnPoint(a.x, a.y, was.cx, was.cy, angle)
  const after = turnPoint(b.x, b.y, now.cx, now.cy, angle)
  return {
    source: next.source,
    inner: { ...next.inner, x: Math.round(next.inner.x + before.x - after.x), y: Math.round(next.inner.y + before.y - after.y) },
  }
}

/** Copy of part of a canvas, `r` may run off its edges. */
export function capture(from: HTMLCanvasElement, r: Rect): HTMLCanvasElement {
  const c = makeCanvas(Math.max(1, r.width), Math.max(1, r.height))
  c.getContext('2d')!.drawImage(from, -r.x, -r.y)
  return c
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.width, b.x + b.width), y1 = Math.min(a.y + a.height, b.y + b.height)
  return x1 > x && y1 > y ? { x, y, width: x1 - x, height: y1 - y } : null
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height
}
