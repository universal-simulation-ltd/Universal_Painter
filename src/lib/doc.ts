// The picture being painted: one canvas, no layers, and its undo history.
//
// It lives outside React on purpose. A brush stroke changes thousands of
// pixels a second, and none of that should be React state; the components
// subscribe to `version`, which moves once per finished edit, and read the
// canvas itself when they draw.
import { History, type Surface } from './history'
import { makeCanvas, stepDown } from './imageFiles'
import { capture, contains, frameOf, intersect, NO_FLIP, normalAngle, overlaps, render, turned, turnPoint, type Flip, type Item, type Source } from './objects'
import { anchorOffset, brightnessContrast, clampRect, greyscale, invert, unionRect, type Rect } from './pixels'

/** Undo memory: generous on a computer, careful on a phone or tablet. */
function historyBudget(): number {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  return (coarse ? 160 : 512) * 1024 * 1024
}

export interface Floating {
  /** The pixels as they look now. */
  canvas: HTMLCanvasElement
  x: number
  y: number
  /** Where they were lifted from; null for a paste or a new QR code. */
  from: Rect | null
  /** What it is, so a resize or restyle draws it again (objects.ts). */
  source: Source
  inner: Rect
  /** Degrees it is turned clockwise about its centre; 0 is upright. */
  angle: number
  flip: Flip
}

/** How many objects stay movable; the oldest becomes plain paint first. */
const MAX_ITEMS = 100

type Listener = () => void

class PaintDoc {
  surface: Surface | null = null
  stem = 'picture'
  /** Unsaved changes since it was opened or last saved. */
  dirty = false
  version = 0
  /** Moves each time a different picture is loaded, so the editor can frame it. */
  loads = 0
  floating: Floating | null = null
  /** The blank canvas Painter opens on, untouched: a picture opened now replaces it. */
  starter = false
  /** The movable objects on the picture, oldest first (objects.ts). */
  items: Item[] = []

  private history = new History(historyBudget())
  /** A copy of the picture as it was when the current edit began. */
  private base: HTMLCanvasElement | null = null
  private editing = false
  /** The objects as they were when the current edit began, kept with its undo step. */
  private itemsAtBegin: Item[] = []
  private listeners = new Set<Listener>()

  get canvas() { return this.surface?.canvas ?? null }
  get width() { return this.surface?.canvas.width ?? 0 }
  get height() { return this.surface?.canvas.height ?? 0 }
  get canUndo() { return this.history.canUndo || !!this.floating }
  get canRedo() { return this.history.canRedo }

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }
  getVersion = () => this.version

  private changed(dirty = true) {
    if (dirty) { this.dirty = true; this.starter = false }
    this.version++
    for (const l of this.listeners) l()
  }

  // ── Opening and closing ────────────────────────────────────────────────────

  load(canvas: HTMLCanvasElement, stem: string) {
    this.history.clear()
    this.floating = null
    this.items = []
    this.starter = false
    this.editing = false
    this.releaseBase()
    this.surface = { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true })! }
    this.stem = stem
    this.dirty = false
    this.loads++
    this.changed(false)
  }

  blank(width: number, height: number, background: string | null, stem = 'picture') {
    const c = makeCanvas(width, height)
    if (background) {
      const ctx = c.getContext('2d')!
      ctx.fillStyle = background
      ctx.fillRect(0, 0, width, height)
    }
    this.load(c, stem)
  }

  close() {
    this.history.clear()
    this.releaseBase()
    this.floating = null
    this.items = []
    this.starter = false
    if (this.surface) {
      this.surface.canvas.width = 0
      this.surface.canvas.height = 0
    }
    this.surface = null
    this.dirty = false
    this.changed(false)
  }

  /** A new name for the picture (the title in the bar); used when it is saved. */
  rename(stem: string) {
    const next = stem.trim()
    if (!next || next === this.stem) return
    this.stem = next
    this.changed(false)
  }

  markSaved(stem?: string) {
    if (stem) this.stem = stem
    this.dirty = false
    this.changed(false)
  }

  // ── Edits that touch part of the picture (strokes, shapes, fills, text) ──

  /** Snapshot the picture before an edit, so it can be undone or cancelled. */
  begin() {
    const s = this.surface
    if (!s) return
    if (!this.base || this.base.width !== s.canvas.width || this.base.height !== s.canvas.height) {
      this.releaseBase()
      this.base = makeCanvas(s.canvas.width, s.canvas.height)
    }
    const b = this.base.getContext('2d')!
    b.clearRect(0, 0, this.base.width, this.base.height)
    b.drawImage(s.canvas, 0, 0)
    this.itemsAtBegin = this.items
    this.editing = true
  }

  /** Throw the edit away and put the snapshot back (a second finger landed mid-stroke). */
  cancel() {
    const s = this.surface
    if (!s || !this.editing || !this.base) return
    s.ctx.save()
    s.ctx.globalCompositeOperation = 'copy'
    s.ctx.drawImage(this.base, 0, 0)
    s.ctx.restore()
    this.items = this.itemsAtBegin
    this.editing = false
    this.changed(false)
  }

  /**
   * Finish an edit that changed `rect` (or nothing, with null). `add` puts a
   * new object down; `keep` says the objects were already seen to (picking
   * one up, or dropping one). Otherwise this was paint, and any object it
   * changed a pixel of becomes paint too.
   */
  commit(rect: Rect | null, opts: { add?: Item; keep?: boolean } = {}) {
    const s = this.surface
    if (!s || !this.editing || !this.base) return
    this.editing = false
    const before = this.itemsAtBegin
    const r = rect && clampRect(rect, s.canvas.width, s.canvas.height)
    if (!r) { this.changed(false); return }
    if (opts.add) this.items = [...this.items, opts.add].slice(-MAX_ITEMS)
    else if (!opts.keep) this.items = this.bakeTouched(this.items, r)
    const data = this.base.getContext('2d', { willReadFrequently: true })!.getImageData(r.x, r.y, r.width, r.height)
    this.history.push({ kind: 'patch', rect: r, data, items: before })
    this.changed()
  }

  get isEditing() { return this.editing }

  // ── Movable objects (objects.ts) ─────────────────────────────────────────

  /** Put a new object down: a box, ellipse, line or text, as one undo step. */
  placeItem(source: Source, inner: Rect, angle = 0, flip: Flip = NO_FLIP) {
    const s = this.surface
    if (!s) return
    this.settle()
    this.begin()
    const { canvas, rect } = render(source, inner, angle, flip)
    const under = capture(s.canvas, rect)
    s.ctx.drawImage(canvas, rect.x, rect.y)
    this.commit(rect, { add: { source, inner, angle, flip, rect, pixels: canvas, under } })
  }

  /**
   * Draw the newest object again with `source` (a shape restyled straight
   * after it was drawn), as that same one undo step. The caller makes sure
   * nothing has happened since it was drawn.
   */
  amendLast(source: Source): boolean {
    const s = this.surface
    const last = this.items[this.items.length - 1]
    if (!s || !last || this.floating || this.editing || !this.history.canUndo) return false
    const back = this.history.undo(s, this.items)
    this.surface = back.surface
    this.items = back.items
    // placeItem's commit pushes a new step, which clears the undone one from redo.
    this.placeItem(source, last.inner, last.angle, last.flip)
    return true
  }

  /** The newest object under (x, y), or -1. A turned one counts only inside its own turned frame. */
  itemAt(x: number, y: number): number {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]
      if (!contains(it.rect, x, y)) continue
      if (!turned(it.angle)) return i
      const { frame, cx, cy } = frameOf(it.source, it.inner)
      const at = turnPoint(x, y, cx, cy, -it.angle)
      if (contains(frame, at.x, at.y)) return i
    }
    return -1
  }

  /**
   * Pick an object up again, whole, putting back what it covered. Objects put
   * down after it are taken off first and put back after, so one lying across
   * it is not wiped where they overlap.
   */
  liftItem(index: number): Floating | null {
    const s = this.surface
    const item = this.items[index]
    if (!s || !item || this.floating) return null
    this.begin()
    const all = this.items
    for (let j = all.length - 1; j >= index; j--) putBack(s.ctx, all[j])
    const kept = all.slice(0, index)
    for (const later of all.slice(index + 1)) {
      kept.push({ ...later, under: capture(s.canvas, later.rect) })
      s.ctx.drawImage(later.pixels, later.rect.x, later.rect.y)
    }
    this.items = kept
    this.floating = { canvas: item.pixels, x: item.rect.x, y: item.rect.y, from: item.rect, source: item.source, inner: item.inner, angle: item.angle, flip: item.flip }
    this.changed(false)
    return this.floating
  }

  /** Draw the floating object again at a new size, in a new style, turned or flipped. */
  reshapeFloating(source: Source, inner: Rect, angle = this.floating?.angle ?? 0, flip = this.floating?.flip ?? NO_FLIP) {
    const f = this.floating
    if (!f) return
    const { canvas, rect } = render(source, inner, angle, flip)
    this.floating = { ...f, canvas, x: rect.x, y: rect.y, source, inner, angle, flip }
    this.changed(false)
  }

  /**
   * Objects whose pixels the edit just committed changed, and the older ones
   * they lie on: they are paint now. (An older one's `under` no longer tells
   * what is beneath a newer one that has become paint on top of it.)
   */
  private bakeTouched(items: Item[], r: Rect): Item[] {
    const s = this.surface
    if (!s || !this.base || !items.length) return items
    const bctx = this.base.getContext('2d', { willReadFrequently: true })!
    const baked = new Set<number>()
    items.forEach((it, i) => {
      const x = intersect(it.rect, r)
      if (!x) return
      const a = new Uint32Array(bctx.getImageData(x.x, x.y, x.width, x.height).data.buffer)
      const b = new Uint32Array(s.ctx.getImageData(x.x, x.y, x.width, x.height).data.buffer)
      for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) { baked.add(i); return }
    })
    return this.withBaked(items, baked)
  }

  /** `items` less those in `baked` and every older one lying under them. */
  private withBaked(items: Item[], baked: Set<number>): Item[] {
    if (!baked.size) return items
    for (let i = items.length - 1; i >= 0; i--) {
      if (!baked.has(i)) continue
      for (let j = 0; j < i; j++) if (overlaps(items[j].rect, items[i].rect)) baked.add(j)
    }
    return items.filter((_, i) => !baked.has(i))
  }

  // ── Edits that replace the whole picture (resize, rotate, crop, adjust) ──

  /** Swap in a new canvas, keeping the old one for undo. */
  replace(next: HTMLCanvasElement) {
    const s = this.surface
    if (!s) return
    this.history.push({ kind: 'whole', canvas: s.canvas, items: this.items })
    // Resized, rotated or cropped: the objects are paint now (undo brings them back).
    this.items = []
    this.surface = { canvas: next, ctx: next.getContext('2d', { willReadFrequently: true })! }
    this.changed()
  }

  /** Run a pixel function over the whole picture as one undoable step. */
  private adjust(fn: (data: Uint8ClampedArray) => void) {
    const s = this.surface
    if (!s) return
    this.settle()
    const next = makeCanvas(s.canvas.width, s.canvas.height)
    const ctx = next.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(s.canvas, 0, 0)
    const img = ctx.getImageData(0, 0, next.width, next.height)
    fn(img.data)
    ctx.putImageData(img, 0, 0)
    this.replace(next)
  }

  greyscale() { this.adjust(greyscale) }
  invert() { this.adjust(invert) }
  brightnessContrast(brightness: number, contrast: number) {
    if (brightness === 0 && contrast === 0) return
    this.adjust((d) => brightnessContrast(d, brightness, contrast))
  }

  rotate(quarterTurns: 1 | 2 | 3) {
    const s = this.surface
    if (!s) return
    this.settle()
    const { width: w, height: h } = s.canvas
    const swapSides = quarterTurns % 2 === 1
    const next = makeCanvas(swapSides ? h : w, swapSides ? w : h)
    const ctx = next.getContext('2d')!
    ctx.translate(next.width / 2, next.height / 2)
    ctx.rotate((quarterTurns * Math.PI) / 2)
    ctx.drawImage(s.canvas, -w / 2, -h / 2)
    this.replace(next)
  }

  /**
   * Turn the whole picture `degrees` clockwise. The canvas grows to hold the
   * turned picture, so no corner is cut off; the new corners are see-through,
   * or `background`.
   */
  rotateBy(degrees: number, background: string | null) {
    const s = this.surface
    if (!s) return
    const a = normalAngle(degrees)
    if (!turned(a)) return
    if (a === 90 || a === -90 || a === 180) { this.rotate(a === 90 ? 1 : a === 180 ? 2 : 3); return }
    this.settle()
    const { width: w, height: h } = s.canvas
    const size = turnedSize(w, h, a)
    const next = makeCanvas(size.width, size.height)
    const ctx = next.getContext('2d')!
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, next.width, next.height) }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.translate(next.width / 2, next.height / 2)
    ctx.rotate((a * Math.PI) / 180)
    if (background) ctx.clearRect(-w / 2, -h / 2, w, h)
    ctx.drawImage(s.canvas, -w / 2, -h / 2)
    this.replace(next)
  }

  flip(horizontal: boolean) {
    const s = this.surface
    if (!s) return
    this.settle()
    const next = makeCanvas(s.canvas.width, s.canvas.height)
    const ctx = next.getContext('2d')!
    if (horizontal) { ctx.translate(next.width, 0); ctx.scale(-1, 1) } else { ctx.translate(0, next.height); ctx.scale(1, -1) }
    ctx.drawImage(s.canvas, 0, 0)
    this.replace(next)
  }

  /** Stretch or shrink the picture itself. */
  resizeImage(width: number, height: number) {
    const s = this.surface
    if (!s || (width === s.canvas.width && height === s.canvas.height)) return
    this.settle()
    const scaled = width < s.canvas.width && height < s.canvas.height
      ? stepDown(s.canvas, 0, 0, s.canvas.width, s.canvas.height, width, height)
      : null
    const next = makeCanvas(width, height)
    const ctx = next.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(scaled ?? s.canvas, 0, 0, width, height)
    if (scaled) { scaled.width = 0; scaled.height = 0 }
    this.replace(next)
  }

  /** Make the canvas bigger or smaller without stretching the picture. */
  resizeCanvas(width: number, height: number, anchor: number, background: string | null) {
    const s = this.surface
    if (!s || (width === s.canvas.width && height === s.canvas.height)) return
    this.settle()
    const next = makeCanvas(width, height)
    const ctx = next.getContext('2d')!
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, width, height) }
    const { dx, dy } = anchorOffset(anchor, s.canvas.width, s.canvas.height, width, height)
    ctx.clearRect(dx, dy, s.canvas.width, s.canvas.height)
    ctx.drawImage(s.canvas, dx, dy)
    this.replace(next)
  }

  crop(rect: Rect) {
    const s = this.surface
    if (!s) return
    this.settle()
    const r = clampRect(rect, s.canvas.width, s.canvas.height)
    if (!r) return
    const next = makeCanvas(r.width, r.height)
    next.getContext('2d')!.drawImage(s.canvas, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
    this.replace(next)
  }

  // ── The floating selection: lifted pixels being moved, or a paste ────────

  /** Lift `rect` off the picture to move it; `copy` leaves the original behind. */
  lift(rect: Rect, copy: boolean): Floating | null {
    const s = this.surface
    if (!s) return null
    const r = clampRect(rect, s.canvas.width, s.canvas.height)
    if (!r) return null
    this.begin()
    const c = makeCanvas(r.width, r.height)
    c.getContext('2d')!.drawImage(s.canvas, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
    if (!copy) {
      s.ctx.clearRect(r.x, r.y, r.width, r.height)
      // Objects partly lifted are paint now: their pixels went with the lift.
      this.items = this.withBaked(this.items, new Set(this.items.flatMap((it, i) => (overlaps(it.rect, r) ? [i] : []))))
    }
    this.floating = { canvas: c, x: r.x, y: r.y, from: r, source: { kind: 'image', canvas: c }, inner: r, angle: 0, flip: NO_FLIP }
    this.changed(false)
    return this.floating
  }

  /** Float a pasted picture at (x, y). Grows the canvas first if it would not fit. */
  float(canvas: HTMLCanvasElement, x: number, y: number) {
    const s = this.surface
    if (!s) return
    this.settle()
    if (canvas.width > s.canvas.width || canvas.height > s.canvas.height) {
      this.resizeCanvas(Math.max(canvas.width, s.canvas.width), Math.max(canvas.height, s.canvas.height), 0, null)
      x = 0
      y = 0
    }
    this.begin()
    this.starter = false
    const inner = { x: Math.round(x), y: Math.round(y), width: canvas.width, height: canvas.height }
    this.floating = { canvas, x: inner.x, y: inner.y, from: null, source: { kind: 'image', canvas }, inner, angle: 0, flip: NO_FLIP }
    this.changed(false)
  }

  moveFloating(x: number, y: number) {
    const f = this.floating
    if (!f) return
    const dx = Math.round(x) - f.x, dy = Math.round(y) - f.y
    f.x += dx
    f.y += dy
    f.inner = { ...f.inner, x: f.inner.x + dx, y: f.inner.y + dy }
    this.changed(false)
  }

  /** Put the floating object down where it is, as one undoable step. It stays movable. */
  settle() {
    const f = this.floating
    const s = this.surface
    if (!f || !s) return
    this.floating = null
    const to = { x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height }
    const under = capture(s.canvas, to)
    s.ctx.drawImage(f.canvas, f.x, f.y)
    this.commit(unionRect(f.from, to), { add: { source: f.source, inner: f.inner, angle: f.angle, flip: f.flip, rect: to, pixels: f.canvas, under } })
  }

  /** Drop the floating object: what it was lifted from stays as it is now, a paste vanishes. */
  discardFloating() {
    const f = this.floating
    if (!f) return
    this.floating = null
    this.commit(f.from, { keep: true })
  }

  // ── Undo / redo ───────────────────────────────────────────────────────────

  undo() {
    if (!this.surface) return
    if (this.floating) this.settle()
    const back = this.history.undo(this.surface, this.items)
    this.surface = back.surface
    this.items = back.items
    this.changed()
  }

  redo() {
    if (!this.surface || this.floating) return
    const next = this.history.redo(this.surface, this.items)
    this.surface = next.surface
    this.items = next.items
    this.changed()
  }

  /** Read one pixel as [r, g, b, a]. */
  pixel(x: number, y: number): [number, number, number, number] | null {
    const s = this.surface
    if (!s) return null
    x = Math.floor(x); y = Math.floor(y)
    if (x < 0 || y < 0 || x >= s.canvas.width || y >= s.canvas.height) return null
    const d = s.ctx.getImageData(x, y, 1, 1).data
    return [d[0], d[1], d[2], d[3]]
  }

  /** A copy of part of the picture (or of the floating pixels) as its own canvas. */
  copyRegion(rect: Rect): HTMLCanvasElement | null {
    const s = this.surface
    if (!s) return null
    if (this.floating) {
      const f = this.floating
      const c = makeCanvas(f.canvas.width, f.canvas.height)
      c.getContext('2d')!.drawImage(f.canvas, 0, 0)
      return c
    }
    const r = clampRect(rect, s.canvas.width, s.canvas.height)
    if (!r) return null
    const c = makeCanvas(r.width, r.height)
    c.getContext('2d')!.drawImage(s.canvas, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
    return c
  }

  /** Clear part of the picture to see-through, as one step. */
  clearRegion(rect: Rect) {
    const s = this.surface
    if (!s) return
    if (this.floating) { this.discardFloating(); return }
    this.begin()
    s.ctx.clearRect(rect.x, rect.y, rect.width, rect.height)
    this.commit(rect)
  }

  private releaseBase() {
    if (this.base) { this.base.width = 0; this.base.height = 0 }
    this.base = null
  }
}

export const doc = new PaintDoc()

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __painterDoc: PaintDoc }).__painterDoc = doc
}

/** Take an object off the canvas: what it covered goes back. */
function putBack(ctx: CanvasRenderingContext2D, it: Item) {
  ctx.clearRect(it.rect.x, it.rect.y, it.rect.width, it.rect.height)
  ctx.drawImage(it.under, it.rect.x, it.rect.y)
}

/** The canvas a `w` × `h` picture needs once turned `degrees`, corners and all. */
export function turnedSize(w: number, h: number, degrees: number): { width: number; height: number } {
  const a = (degrees * Math.PI) / 180
  const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a))
  // A hair under a whole pixel is rounding, not a pixel more.
  return { width: Math.max(1, Math.ceil(w * cos + h * sin - 1e-6)), height: Math.max(1, Math.ceil(w * sin + h * cos - 1e-6)) }
}
