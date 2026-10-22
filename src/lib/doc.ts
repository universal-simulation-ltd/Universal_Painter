// The picture being painted: one canvas, no layers, and its undo history.
//
// It lives outside React on purpose. A brush stroke changes thousands of
// pixels a second, and none of that should be React state; the components
// subscribe to `version`, which moves once per finished edit, and read the
// canvas itself when they draw.
import { History, type Surface } from './history'
import { makeCanvas, stepDown } from './imageFiles'
import { anchorOffset, brightnessContrast, clampRect, greyscale, invert, unionRect, type Rect } from './pixels'

/** Undo memory: generous on a computer, careful on a phone or tablet. */
function historyBudget(): number {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  return (coarse ? 160 : 512) * 1024 * 1024
}

export interface Floating {
  /** The lifted (or pasted) pixels. */
  canvas: HTMLCanvasElement
  x: number
  y: number
  /** Where they were lifted from; null for a paste. */
  from: Rect | null
}

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

  private history = new History(historyBudget())
  /** A copy of the picture as it was when the current edit began. */
  private base: HTMLCanvasElement | null = null
  private editing = false
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
    if (dirty) this.dirty = true
    this.version++
    for (const l of this.listeners) l()
  }

  // ── Opening and closing ────────────────────────────────────────────────────

  load(canvas: HTMLCanvasElement, stem: string) {
    this.history.clear()
    this.floating = null
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
    if (this.surface) {
      this.surface.canvas.width = 0
      this.surface.canvas.height = 0
    }
    this.surface = null
    this.dirty = false
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
    this.editing = false
    this.changed(false)
  }

  /** Finish an edit that changed `rect` (or nothing, with null). */
  commit(rect: Rect | null) {
    const s = this.surface
    if (!s || !this.editing || !this.base) return
    this.editing = false
    const r = rect && clampRect(rect, s.canvas.width, s.canvas.height)
    if (!r) { this.changed(false); return }
    const data = this.base.getContext('2d', { willReadFrequently: true })!.getImageData(r.x, r.y, r.width, r.height)
    this.history.push({ kind: 'patch', rect: r, data })
    this.changed()
  }

  get isEditing() { return this.editing }

  // ── Edits that replace the whole picture (resize, rotate, crop, adjust) ──

  /** Swap in a new canvas, keeping the old one for undo. */
  replace(next: HTMLCanvasElement) {
    const s = this.surface
    if (!s) return
    this.history.push({ kind: 'whole', canvas: s.canvas })
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
    if (!copy) s.ctx.clearRect(r.x, r.y, r.width, r.height)
    this.floating = { canvas: c, x: r.x, y: r.y, from: r }
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
    this.floating = { canvas, x: Math.round(x), y: Math.round(y), from: null }
    this.changed(false)
  }

  moveFloating(x: number, y: number) {
    if (!this.floating) return
    this.floating.x = Math.round(x)
    this.floating.y = Math.round(y)
    this.changed(false)
  }

  /** Put the floating pixels down where they are, as one undoable step. */
  settle() {
    const f = this.floating
    const s = this.surface
    if (!f || !s) return
    this.floating = null
    s.ctx.drawImage(f.canvas, f.x, f.y)
    const to = { x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height }
    f.canvas.width = 0
    f.canvas.height = 0
    this.commit(unionRect(f.from, to))
  }

  /** Drop the floating pixels: a lifted area stays cleared, a paste vanishes. */
  discardFloating() {
    const f = this.floating
    if (!f) return
    this.floating = null
    f.canvas.width = 0
    f.canvas.height = 0
    this.commit(f.from)
  }

  // ── Undo / redo ───────────────────────────────────────────────────────────

  undo() {
    if (!this.surface) return
    if (this.floating) this.settle()
    this.surface = this.history.undo(this.surface)
    this.changed()
  }

  redo() {
    if (!this.surface || this.floating) return
    this.surface = this.history.redo(this.surface)
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
