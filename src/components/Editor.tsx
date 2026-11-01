// The canvas: where the picture is shown, and where every pointer — mouse,
// finger or Apple Pencil — becomes paint, a selection, a pan or a zoom.
//
// The picture is drawn at its own size inside a "stage" that is scaled and
// moved with a CSS transform, so zooming never re-renders a pixel. Previews
// (a box being dragged, a line) go on a second canvas over it, the same size
// as the picture, and are only painted into the picture when the pointer
// lifts — one undo step per gesture.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { doc, type Floating } from '../lib/doc'
import { brushLine, drawLine, drawShape, fontFor, LINE_HEIGHT, pencilLine, type ShapeInk } from '../lib/draw'
import { contains, frameOf, normalAngle, resizedTurned, textInner, turnedCorners, turnPoint, type Source } from '../lib/objects'
import { floodFill, parseHex, rectFromPoints, snap45, squareUp, toHex, unionRect, type Rect } from '../lib/pixels'
import { showOpening, turnFloating, viewport, zoomBy } from '../lib/actions'
import { usePaintStore, type Tool } from '../stores/paintStore'
import { useSettings } from '../stores/settingsStore'
import { useT } from '../i18n'
import { TurnIcon } from './icons'

type Pt = { x: number; y: number }

type Gesture =
  | { kind: 'paint'; id: number; tool: 'pencil' | 'brush' | 'eraser'; last: Pt; colour: string; dirty: Rect | null }
  | { kind: 'shape'; id: number; tool: ShapeTool; start: Pt; end: Pt; ink: ShapeInk; swapped: boolean; shown: Rect | null }
  | { kind: 'select'; id: number; start: Pt }
  | { kind: 'move'; id: number; grab: Pt; origin: Pt }
  /** A corner handle of the selected object: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left. */
  | { kind: 'resize'; id: number; corner: number; source: Source; inner: Rect; angle: number }
  /** The round arrow above the selected object, turning it about its centre (cx, cy). */
  | { kind: 'turn'; id: number; cx: number; cy: number }
  | { kind: 'pan'; id: number; from: Pt; panX: number; panY: number }
  | { kind: 'pinch'; ids: [number, number]; dist: number; mid: Pt; zoom: number; panX: number; panY: number }

interface TextBox { id: number; x: number; y: number; value: string }

type ShapeTool = 'line' | 'box' | 'ellipse'

/**
 * The shape just drawn, while nothing else has happened (`version` is the
 * doc's version straight after it): changing the shape style, the line width
 * or a colour redraws it that way instead of only the next one, as one undo
 * step (James, 2026-10-30: "box filled, then click outline").
 */
interface LastShape { tool: ShapeTool; version: number }

/** The object a finished shape gesture leaves: whole pixels, Shift's square or 45° applied. */
function shapeObject(g: Extract<Gesture, { kind: 'shape' }>, shift: boolean): { source: Source; inner: Rect } {
  const a = { x: Math.round(g.start.x), y: Math.round(g.start.y) }
  const raw = g.tool === 'line'
    ? (shift ? snap45(g.start.x, g.start.y, g.end.x, g.end.y) : g.end)
    : (shift ? squareUp(g.start.x, g.start.y, g.end.x, g.end.y) : g.end)
  const b = { x: Math.round(raw.x), y: Math.round(raw.y) }
  const inner = rectFromPoints(a.x, a.y, b.x, b.y)
  if (g.tool === 'line') return { source: { kind: 'line', ink: g.ink, fromRight: a.x > b.x, fromBottom: a.y > b.y }, inner }
  return { source: { kind: 'shape', tool: g.tool, ink: g.ink }, inner }
}

/**
 * A changed shape style, line width or colour, applied to an object's own
 * look: only what changed, so selecting a red box and picking a new width
 * leaves it red.
 */
function restyled(source: Source, s: ReturnType<typeof usePaintStore.getState>, prev: ReturnType<typeof usePaintStore.getState>): Source | null {
  if (source.kind === 'image') return null
  if (source.kind === 'text') return s.primary !== prev.primary ? { ...source, colour: s.primary } : null
  const ink = { ...source.ink }
  if (source.kind === 'shape' && s.shapeStyle !== prev.shapeStyle) ink.style = s.shapeStyle
  if (s.sizes.shape !== prev.sizes.shape) ink.width = s.sizes.shape
  if (s.primary !== prev.primary) ink.primary = s.primary
  if (s.secondary !== prev.secondary) ink.secondary = s.secondary
  const same = ink.style === source.ink.style && ink.width === source.ink.width && ink.primary === source.ink.primary && ink.secondary === source.ink.secondary
  return same ? null : { ...source, ink }
}

/** How near a corner handle a press has to land, in screen pixels. */
const HANDLE_REACH = { mouse: 9, touch: 22 }

/**
 * The round arrow to turn the selected object (James, 2026-11-01: "an icon
 * next to the image to control the degree of rotation"): how far above the
 * object's top edge it sits, and how near a press has to land, in screen pixels.
 */
const TURN_GAP = { mouse: 30, touch: 40 }
const TURN_REACH = { mouse: 14, touch: 24 }

/** Coarse pointers (fingers) get the bigger handles, as the CSS does. */
const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Where the turn arrow of `f` sits on screen, and the middle of the top edge it hangs from. */
function turnHandle(f: Floating, zoom: number, panX: number, panY: number) {
  const gap = coarse() ? TURN_GAP.touch : TURN_GAP.mouse
  const { frame, cx, cy } = frameOf(f.source, f.inner)
  const top = turnPoint(cx, frame.y, cx, cy, f.angle)
  const a = (f.angle * Math.PI) / 180
  const fromX = panX + top.x * zoom, fromY = panY + top.y * zoom
  return { x: fromX + Math.sin(a) * gap, y: fromY - Math.cos(a) * gap, fromX, fromY, gap }
}

/** The ink a shape is drawn with; a right-button shape swaps the two colours. */
function inkFor(s: ReturnType<typeof usePaintStore.getState>, tool: ShapeTool, swapped: boolean): ShapeInk {
  return {
    primary: swapped ? s.secondary : s.primary,
    secondary: swapped ? s.primary : s.secondary,
    width: s.sizes.shape,
    style: tool === 'line' ? 'outline' : s.shapeStyle,
  }
}

const DRAW_TOOLS: Tool[] = ['pencil', 'brush', 'eraser', 'fill', 'line', 'box', 'ellipse', 'text', 'picker', 'select']

export default function Editor() {
  const t = useT()
  const version = useSyncExternalStore(doc.subscribe, doc.getVersion)
  const tool = usePaintStore((s) => s.tool)
  const zoom = usePaintStore((s) => s.zoom)
  const panX = usePaintStore((s) => s.panX)
  const panY = usePaintStore((s) => s.panY)
  const selection = usePaintStore((s) => s.selection)
  const primary = usePaintStore((s) => s.primary)
  const fontSize = usePaintStore((s) => s.fontSize)
  const bold = usePaintStore((s) => s.bold)
  const pixelGrid = useSettings((s) => s.pixelGrid)

  const viewRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const floatHostRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>())
  const gesture = useRef<Gesture | null>(null)
  const spaceDown = useRef(false)
  const [textBox, setTextBox] = useState<TextBox | null>(null)
  const textBoxRef = useRef<TextBox | null>(null)
  textBoxRef.current = textBox
  const [panning, setPanning] = useState(false)
  const [turning, setTurning] = useState(false)

  const w = doc.width
  const h = doc.height

  // Put the picture's own canvas (and any floating selection) into the stage.
  // Undo of a rotate swaps the canvas object itself, so this follows `version`.
  useLayoutEffect(() => {
    const host = hostRef.current
    const c = doc.canvas
    if (host && c && host.firstChild !== c) {
      c.className = 'pt-pixels'
      host.replaceChildren(c)
    }
    const fh = floatHostRef.current
    const f = doc.floating
    if (fh) {
      if (f) {
        f.canvas.className = 'pt-pixels'
        if (fh.firstChild !== f.canvas) fh.replaceChildren(f.canvas)
        fh.style.transform = `translate(${f.x}px, ${f.y}px)`
      } else if (fh.firstChild) {
        fh.replaceChildren()
      }
    }
    const p = previewRef.current
    if (p && (p.width !== w || p.height !== h)) { p.width = w; p.height = h }
  }, [version, w, h])

  // Keep the shared viewport size current (Fit and the zoom buttons use it).
  useLayoutEffect(() => {
    const el = viewRef.current
    if (!el) return
    const measure = () => { viewport.width = el.clientWidth; viewport.height = el.clientHeight }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Frame each newly loaded picture: the opening view the person chose
  // (double-tap Fit or 100%), else Fit.
  const loads = doc.loads
  useLayoutEffect(() => {
    const el = viewRef.current
    if (!el) return
    viewport.width = el.clientWidth
    viewport.height = el.clientHeight
    showOpening()
  }, [loads])

  const toDoc = useCallback((clientX: number, clientY: number): Pt => {
    const r = viewRef.current!.getBoundingClientRect()
    const s = usePaintStore.getState()
    return { x: (clientX - r.left - s.panX) / s.zoom, y: (clientY - r.top - s.panY) / s.zoom }
  }, [])
  const local = useCallback((clientX: number, clientY: number): Pt => {
    const r = viewRef.current!.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }, [])

  // ── Text ────────────────────────────────────────────────────────────────
  const commitText = useCallback(() => {
    const box = textBoxRef.current
    setTextBox(null)
    if (!box || !box.value.trim() || !doc.surface) return
    const s = usePaintStore.getState()
    // Text is an object: Select can pick it up, move it and resize it.
    doc.placeItem(
      { kind: 'text', value: box.value, size: s.fontSize, bold: s.bold, colour: s.primary },
      textInner(box.value, s.fontSize, s.bold, box.x, box.y),
    )
  }, [])
  useEffect(() => { if (tool !== 'text') commitText() }, [tool, commitText])
  useLayoutEffect(() => {
    if (!textBox) return
    const focus = () => textRef.current?.focus({ preventScroll: true })
    focus()
    const id = window.setTimeout(focus, 60)
    return () => clearTimeout(id)
  }, [textBox?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Done in the options row asks for this.
  useEffect(() => {
    const onDone = () => commitText()
    window.addEventListener('painter:commit-text', onDone)
    return () => window.removeEventListener('painter:commit-text', onDone)
  }, [commitText])

  // ── Preview canvas ─────────────────────────────────────────────────────
  const clearPreview = (r: Rect | null) => {
    const p = previewRef.current
    if (!p || !r) return
    p.getContext('2d')!.clearRect(r.x, r.y, r.width, r.height)
  }
  const drawShapeTo = (ctx: CanvasRenderingContext2D, g: Extract<Gesture, { kind: 'shape' }>, shift: boolean): Rect => {
    if (g.tool === 'line') {
      const end = shift ? snap45(g.start.x, g.start.y, g.end.x, g.end.y) : g.end
      return drawLine(ctx, g.start.x, g.start.y, end.x, end.y, g.ink)
    }
    const end = shift ? squareUp(g.start.x, g.start.y, g.end.x, g.end.y) : g.end
    return drawShape(ctx, g.tool, rectFromPoints(g.start.x, g.start.y, end.x, end.y), g.ink)
  }

  // A change of style, width or colour restyles the selected object, or the
  // shape just drawn.
  const lastShape = useRef<LastShape | null>(null)
  useEffect(() => usePaintStore.subscribe((s, prev) => {
    const f = doc.floating
    if (f) {
      const next = restyled(f.source, s, prev)
      if (next) doc.reshapeFloating(next, f.inner)
      return
    }
    const last = lastShape.current
    if (!last) return
    const item = doc.items[doc.items.length - 1]
    if (s.tool !== last.tool || doc.version !== last.version || !item) { lastShape.current = null; return }
    const next = restyled(item.source, s, prev)
    if (next && doc.amendLast(next)) lastShape.current = { ...last, version: doc.version }
  }), [])

  /** Pick up object `i` with Select, and set the style controls to match it. */
  const pickUp = (i: number) => {
    const f = doc.liftItem(i)
    if (!f) return null
    const s = usePaintStore.getState()
    s.setSelection({ x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height })
    // Only the shape style and width: the colours stay the person's own.
    if (f.source.kind === 'shape') s.setShapeStyle(f.source.ink.style)
    if (f.source.kind === 'shape' || f.source.kind === 'line') s.setSize('shape', f.source.ink.width)
    return f
  }

  /** The corner handle of the floating object under a screen point, or -1. */
  const handleAt = (clientX: number, clientY: number, pointerType: string): number => {
    const f = doc.floating
    if (!f || usePaintStore.getState().tool !== 'select') return -1
    const at = local(clientX, clientY)
    const { zoom, panX, panY } = usePaintStore.getState()
    const reach = pointerType === 'mouse' ? HANDLE_REACH.mouse : HANDLE_REACH.touch
    // The corners of the object as it sits, turned or not.
    return turnedCorners(f.source, f.inner, f.angle)
      .findIndex((c) => Math.abs(panX + c.x * zoom - at.x) <= reach && Math.abs(panY + c.y * zoom - at.y) <= reach)
  }

  /** Whether a screen point is on the floating object's turn arrow. */
  const onTurnHandle = (clientX: number, clientY: number, pointerType: string): boolean => {
    const f = doc.floating
    if (!f || usePaintStore.getState().tool !== 'select') return false
    const at = local(clientX, clientY)
    const { zoom, panX, panY } = usePaintStore.getState()
    const th = turnHandle(f, zoom, panX, panY)
    return Math.hypot(th.x - at.x, th.y - at.y) <= (pointerType === 'mouse' ? TURN_REACH.mouse : TURN_REACH.touch)
  }

  // ── Pointer handling ───────────────────────────────────────────────────
  const widthFor = (e: PointerEvent | React.PointerEvent, size: number) => {
    if (e.pointerType !== 'pen' || useSettings.getState().ignorePressure) return size
    const p = e.pressure || 0.5
    return size * Math.min(1.8, Math.max(0.2, 0.2 + p * 1.6))
  }

  const startPinch = () => {
    const ids = [...pointers.current.keys()].slice(0, 2) as [number, number]
    const a = pointers.current.get(ids[0])!, b = pointers.current.get(ids[1])!
    const s = usePaintStore.getState()
    gesture.current = {
      kind: 'pinch', ids,
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      zoom: s.zoom, panX: s.panX, panY: s.panY,
    }
  }

  /** A gesture is being replaced (a second finger landed): undo what it drew so far. */
  const abandon = () => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'paint') doc.cancel()
    if (g.kind === 'shape') clearPreview(g.shown)
    gesture.current = null
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!doc.surface) return
    // No browser default for a press on the canvas: it would move focus to
    // the page (stealing it from the text box being opened) and start a text
    // selection on a long press.
    e.preventDefault()
    const el = viewRef.current!
    const pt = local(e.clientX, e.clientY)
    pointers.current.set(e.pointerId, { ...pt, type: e.pointerType })
    try { el.setPointerCapture(e.pointerId) } catch { /* synthetic events */ }

    const touches = [...pointers.current.values()].filter((p) => p.type === 'touch').length
    if (e.pointerType === 'touch' && touches >= 2) {
      abandon()
      startPinch()
      return
    }
    if (gesture.current) return

    const s = usePaintStore.getState()
    const penOnly = useSettings.getState().penOnly
    const wantsPan = s.tool === 'hand' || e.button === 1 || spaceDown.current || (penOnly && e.pointerType === 'touch')
    if (wantsPan) {
      gesture.current = { kind: 'pan', id: e.pointerId, from: pt, panX: s.panX, panY: s.panY }
      setPanning(true)
      return
    }
    if (e.button !== 0 && e.button !== 2) return
    const secondary = e.button === 2
    const colour = secondary ? s.secondary : s.primary
    const p = toDoc(e.clientX, e.clientY)

    if (textBoxRef.current && s.tool !== 'text') commitText()

    switch (s.tool) {
      case 'pencil':
      case 'brush':
      case 'eraser': {
        doc.begin()
        const size = s.sizes[s.tool]
        const r = s.tool === 'pencil'
          ? pencilLine(doc.surface.ctx, p.x, p.y, p.x, p.y, size, colour)
          : brushLine(doc.surface.ctx, p.x, p.y, p.x, p.y, widthFor(e, size), colour, s.tool === 'eraser')
        gesture.current = { kind: 'paint', id: e.pointerId, tool: s.tool, last: p, colour, dirty: r }
        return
      }
      case 'line':
      case 'box':
      case 'ellipse': {
        const ink = inkFor(s, s.tool, secondary)
        gesture.current = { kind: 'shape', id: e.pointerId, tool: s.tool, start: p, end: p, ink, swapped: secondary, shown: null }
        return
      }
      case 'fill': {
        const s2 = doc.surface
        doc.begin()
        const img = s2.ctx.getImageData(0, 0, s2.canvas.width, s2.canvas.height)
        const r = floodFill(img.data, img.width, img.height, p.x, p.y, parseHex(colour), s.tolerance)
        if (r) s2.ctx.putImageData(img, 0, 0, r.x, r.y, r.width, r.height)
        doc.commit(r)
        return
      }
      case 'picker': {
        const px = doc.pixel(p.x, p.y)
        if (px) {
          const hex = toHex(px[0], px[1], px[2])
          if (secondary) s.setSecondary(hex)
          else s.setPrimary(hex)
          s.notify(t('notices.picked', { hex }))
          s.setTool(s.lastTool === 'picker' ? 'brush' : s.lastTool)
        }
        return
      }
      case 'text': {
        if (textBoxRef.current) { commitText(); return }
        setTextBox({ id: Date.now(), x: Math.round(p.x), y: Math.round(p.y), value: '' })
        return
      }
      case 'select': {
        const f = doc.floating
        const sel = s.selection
        const inside = (r: Rect) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.width && p.y <= r.y + r.height
        if (f && onTurnHandle(e.clientX, e.clientY, e.pointerType)) {
          const { cx, cy } = frameOf(f.source, f.inner)
          gesture.current = { kind: 'turn', id: e.pointerId, cx, cy }
          setTurning(true)
          return
        }
        const corner = handleAt(e.clientX, e.clientY, e.pointerType)
        if (f && corner >= 0) {
          gesture.current = { kind: 'resize', id: e.pointerId, corner, source: f.source, inner: f.inner, angle: f.angle }
          return
        }
        if (f && inside({ x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height })) {
          gesture.current = { kind: 'move', id: e.pointerId, grab: p, origin: { x: f.x, y: f.y } }
          return
        }
        if (!f && sel && inside(sel)) {
          const lifted = doc.lift(sel, e.altKey)
          if (lifted) {
            gesture.current = { kind: 'move', id: e.pointerId, grab: p, origin: { x: lifted.x, y: lifted.y } }
            return
          }
        }
        if (f) doc.settle()
        // An object (a box, a line, text, a paste): a click picks the whole of
        // it up, with corner handles to resize it, ready to drag.
        const hit = doc.itemAt(p.x, p.y)
        const again = hit >= 0 ? pickUp(hit) : null
        if (again) {
          gesture.current = { kind: 'move', id: e.pointerId, grab: p, origin: { x: again.x, y: again.y } }
          return
        }
        s.setSelection(null)
        gesture.current = { kind: 'select', id: e.pointerId, start: p }
        return
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) { hover(e); return }
    const pt = local(e.clientX, e.clientY)
    pointers.current.set(e.pointerId, { ...pt, type: e.pointerType })
    const g = gesture.current
    if (!g || !doc.surface) return
    const s = usePaintStore.getState()

    if (g.kind === 'pinch') {
      const a = pointers.current.get(g.ids[0]), b = pointers.current.get(g.ids[1])
      if (!a || !b) return
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const z = Math.max(0.02, Math.min(32, g.zoom * (dist / g.dist)))
      const k = z / g.zoom
      // The point under the fingers' midpoint stays under it, and moving both
      // fingers together pans.
      s.setView(z, mid.x - (g.mid.x - g.panX) * k, mid.y - (g.mid.y - g.panY) * k)
      return
    }
    if ('id' in g && g.id !== e.pointerId) return

    if (g.kind === 'pan') {
      s.setView(s.zoom, g.panX + pt.x - g.from.x, g.panY + pt.y - g.from.y)
      return
    }
    const p = toDoc(e.clientX, e.clientY)
    if (g.kind === 'paint') {
      const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : []
      const list = events.length ? events : [e.nativeEvent]
      const ctx = doc.surface.ctx
      const size = s.sizes[g.tool]
      for (const ev of list) {
        const q = toDoc(ev.clientX, ev.clientY)
        const r = g.tool === 'pencil'
          ? pencilLine(ctx, g.last.x, g.last.y, q.x, q.y, size, g.colour)
          : brushLine(ctx, g.last.x, g.last.y, q.x, q.y, widthFor(ev, size), g.colour, g.tool === 'eraser')
        g.dirty = unionRect(g.dirty, r)
        g.last = q
      }
      return
    }
    if (g.kind === 'shape') {
      g.end = p
      const prev = previewRef.current?.getContext('2d')
      if (!prev) return
      clearPreview(g.shown)
      g.shown = drawShapeTo(prev, g, e.shiftKey)
      return
    }
    if (g.kind === 'select') {
      const r = rectFromPoints(Math.round(g.start.x), Math.round(g.start.y), Math.round(p.x), Math.round(p.y))
      const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y)
      const x1 = Math.min(doc.width, r.x + r.width), y1 = Math.min(doc.height, r.y + r.height)
      s.setSelection(x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null)
      return
    }
    if (g.kind === 'move') {
      const nx = g.origin.x + (p.x - g.grab.x)
      const ny = g.origin.y + (p.y - g.grab.y)
      doc.moveFloating(nx, ny)
      const f = doc.floating
      if (f) s.setSelection({ x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height })
      return
    }
    if (g.kind === 'resize') {
      // Always from the object as it was when the handle was grabbed, so text
      // sizes and rounding never compound.
      const next = resizedTurned(g.source, g.inner, g.angle, g.corner, p.x, p.y, e.shiftKey)
      doc.reshapeFloating(next.source, next.inner)
      const f = doc.floating
      if (f) s.setSelection({ x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height })
      return
    }
    if (g.kind === 'turn') {
      // Straight up from the centre is 0°. Whole degrees; Shift turns in 15°
      // steps, and without it the object settles on upright and the quarter
      // turns when it comes within a few degrees of them.
      let a = normalAngle((Math.atan2(p.y - g.cy, p.x - g.cx) * 180) / Math.PI + 90)
      if (e.shiftKey) a = Math.round(a / 15) * 15
      else {
        const quarter = Math.round(a / 90) * 90
        if (Math.abs(a - quarter) < 4) a = quarter
      }
      turnFloating(normalAngle(Math.round(a)))
    }
  }

  /** With Select, a mouse over something that can be dragged shows the move cursor. */
  const hover = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewRef.current
    if (!el || e.pointerType !== 'mouse' || !doc.surface) return
    const s = usePaintStore.getState()
    let movable = false
    let corner = -1
    let turn = false
    if (s.tool === 'select') {
      const p = toDoc(e.clientX, e.clientY)
      const sel = s.selection
      turn = onTurnHandle(e.clientX, e.clientY, e.pointerType)
      corner = handleAt(e.clientX, e.clientY, e.pointerType)
      movable = (!!sel && contains(sel, p.x, p.y)) || doc.itemAt(p.x, p.y) >= 0
    }
    el.dataset.movable = movable ? 'true' : ''
    el.dataset.handle = turn ? 'turn' : corner < 0 ? '' : corner % 2 === 0 ? 'nwse' : 'nesw'
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      if (!g.ids.includes(e.pointerId)) return
      // One finger left on the glass carries on as a pan, not as paint.
      const rest = [...pointers.current.entries()][0]
      const s = usePaintStore.getState()
      gesture.current = rest ? { kind: 'pan', id: rest[0], from: { x: rest[1].x, y: rest[1].y }, panX: s.panX, panY: s.panY } : null
      return
    }
    if (g.id !== e.pointerId) return
    gesture.current = null
    setPanning(false)
    setTurning(false)
    if (!doc.surface) return
    if (g.kind === 'paint') {
      doc.commit(g.dirty)
    } else if (g.kind === 'shape') {
      clearPreview(g.shown)
      if (g.start.x === g.end.x && g.start.y === g.end.y) return
      // Shapes are objects: Select can pick one up, move it and resize it.
      const made = shapeObject(g, e.shiftKey)
      doc.placeItem(made.source, made.inner)
      lastShape.current = { tool: g.tool, version: doc.version }
    }
  }

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch' || g.id === e.pointerId) {
      if (g.kind === 'paint') doc.commit(g.dirty)
      else abandon()
      gesture.current = null
      setPanning(false)
      setTurning(false)
    }
  }

  // Wheel: Ctrl/⌘ + wheel (and a trackpad pinch, which arrives as Ctrl +
  // wheel) zooms about the pointer; a plain wheel or two-finger swipe pans.
  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!doc.surface) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top)
      } else {
        const s = usePaintStore.getState()
        s.setView(s.zoom, s.panX - e.deltaX, s.panY - e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Space held turns any tool into the hand, as in every paint program.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null
      return !!tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)
    }
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e)) { spaceDown.current = true; e.preventDefault() } }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const pixelated = zoom >= 2
  const showGrid = pixelGrid && zoom >= 8
  const floating = doc.floating
  const cursor = panning || tool === 'hand' ? 'grab' : DRAW_TOOLS.includes(tool) ? (tool === 'select' ? 'crosshair' : tool === 'text' ? 'text' : 'crosshair') : 'default'

  return (
    <div
      ref={viewRef}
      className="pt-viewport relative h-full w-full overflow-hidden select-none"
      style={{ touchAction: 'none', ['--pt-cursor' as string]: cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      data-version={version}
      data-turning={turning ? 'true' : undefined}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, width: w, height: h }}
        role="img"
        aria-label={t('app.canvas_label', { w, h })}
      >
        <div className="pt-checker absolute inset-0 shadow-[0_1px_8px_rgba(15,23,42,0.25)]" style={{ backgroundSize: `${16 / zoom}px ${16 / zoom}px` }} />
        <div ref={hostRef} className={`absolute inset-0 ${pixelated ? 'pt-pixelated' : ''}`} />
        <canvas ref={previewRef} className={`absolute left-0 top-0 pointer-events-none ${pixelated ? 'pt-pixelated' : ''}`} style={{ width: w, height: h }} />
        <div ref={floatHostRef} className={`absolute left-0 top-0 pointer-events-none ${pixelated ? 'pt-pixelated' : ''}`} />
      </div>

      {showGrid && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: panX, top: panY, width: w * zoom, height: h * zoom,
            backgroundImage: 'linear-gradient(to right, rgba(100,116,139,.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,.45) 1px, transparent 1px)',
            backgroundSize: `${zoom}px ${zoom}px`,
          }}
        />
      )}

      {selection && !floating && (
        <div
          className="pt-marquee pointer-events-none absolute"
          style={{
            left: panX + selection.x * zoom - 1,
            top: panY + selection.y * zoom - 1,
            width: selection.width * zoom + 2,
            height: selection.height * zoom + 2,
            cursor: 'move',
          }}
        />
      )}
      {selection && floating && <ObjectFrame f={floating} zoom={zoom} panX={panX} panY={panY} handles={tool === 'select'} turning={turning} />}

      {textBox && (
        <textarea
          ref={textRef}
          value={textBox.value}
          placeholder={t('options.text_placeholder')}
          onChange={(e) => setTextBox({ ...textBox, value: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); setTextBox(null) }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitText() }
          }}
          rows={Math.max(1, textBox.value.split('\n').length)}
          className="pt-textbox absolute resize-none overflow-hidden border border-dashed border-orange-500 bg-transparent p-0 outline-none"
          style={{
            left: panX + textBox.x * zoom,
            top: panY + textBox.y * zoom,
            font: fontFor(fontSize * zoom, bold),
            lineHeight: LINE_HEIGHT,
            color: primary,
            minWidth: Math.max(80, fontSize * zoom * 4),
            width: `${Math.max(4, ...textBox.value.split('\n').map((l) => l.length + 1)) * 0.62 * fontSize * zoom}px`,
            maxWidth: `calc(100% - ${Math.max(0, panX + textBox.x * zoom)}px)`,
          }}
          aria-label={t('tools.text')}
        />
      )}
    </div>
  )
}

/**
 * The picked-up object's outline, turned with it, with a handle on each
 * corner to resize it and the round arrow above it to turn it. While it is
 * being turned the angle shows by the arrow.
 */
function ObjectFrame({ f, zoom, panX, panY, handles, turning }: { f: Floating; zoom: number; panX: number; panY: number; handles: boolean; turning: boolean }) {
  const { frame, cx, cy } = frameOf(f.source, f.inner)
  const th = turnHandle(f, zoom, panX, panY)
  const turn = f.angle ? `rotate(${f.angle}deg)` : undefined
  return (
    <>
      <div
        className="pt-marquee pointer-events-none absolute"
        data-floating="true"
        style={{
          left: panX + cx * zoom - (frame.width * zoom) / 2 - 1,
          top: panY + cy * zoom - (frame.height * zoom) / 2 - 1,
          width: frame.width * zoom + 2,
          height: frame.height * zoom + 2,
          transform: turn,
        }}
      />
      {handles && turnedCorners(f.source, f.inner, f.angle).map((c, i) => (
        <div
          key={i}
          aria-hidden="true"
          data-handle-corner={i}
          className="pt-handle pointer-events-none absolute"
          style={{ left: panX + c.x * zoom, top: panY + c.y * zoom, transform: turn }}
        />
      ))}
      {handles && (
        <>
          <div
            aria-hidden="true"
            className="pt-turn-stem pointer-events-none absolute"
            style={{ left: th.fromX, top: th.fromY, height: Math.max(0, th.gap - 12), transform: `rotate(${f.angle + 180}deg)` }}
          />
          <div aria-hidden="true" data-turn-handle className="pt-turn pointer-events-none absolute" style={{ left: th.x, top: th.y }}>
            <TurnIcon size={16} />
          </div>
          {turning && (
            <span
              data-turn-angle
              className="pointer-events-none absolute rounded-md bg-slate-900/85 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white"
              style={{ left: th.x + 22, top: th.y - 11 }}
            >
              {Math.round(f.angle)}°
            </span>
          )}
        </>
      )}
    </>
  )
}
