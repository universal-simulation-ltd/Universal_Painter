// The canvas: where the picture is shown, and where every pointer — mouse,
// finger or Apple Pencil — becomes paint, a selection, a pan or a zoom.
//
// The picture is drawn at its own size inside a "stage" that is scaled and
// moved with a CSS transform, so zooming never re-renders a pixel. Previews
// (a box being dragged, a line) go on a second canvas over it, the same size
// as the picture, and are only painted into the picture when the pointer
// lifts — one undo step per gesture.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { doc } from '../lib/doc'
import { brushLine, drawLine, drawShape, drawText, fontFor, LINE_HEIGHT, pencilLine, type ShapeInk } from '../lib/draw'
import { floodFill, parseHex, rectFromPoints, snap45, squareUp, toHex, unionRect, type Rect } from '../lib/pixels'
import { showOpening, viewport, zoomBy } from '../lib/actions'
import { usePaintStore, type Tool } from '../stores/paintStore'
import { useSettings } from '../stores/settingsStore'
import { useT } from '../i18n'

type Pt = { x: number; y: number }

type Gesture =
  | { kind: 'paint'; id: number; tool: 'pencil' | 'brush' | 'eraser'; last: Pt; colour: string; dirty: Rect | null }
  | { kind: 'shape'; id: number; tool: 'line' | 'box' | 'ellipse'; start: Pt; end: Pt; ink: ShapeInk; shown: Rect | null }
  | { kind: 'select'; id: number; start: Pt }
  | { kind: 'move'; id: number; grab: Pt; origin: Pt }
  | { kind: 'pan'; id: number; from: Pt; panX: number; panY: number }
  | { kind: 'pinch'; ids: [number, number]; dist: number; mid: Pt; zoom: number; panX: number; panY: number }

interface TextBox { id: number; x: number; y: number; value: string }

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
    doc.begin()
    const r = drawText(doc.surface.ctx, box.value, box.x, box.y, s.fontSize, s.bold, s.primary)
    doc.commit(r)
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
        const ink: ShapeInk = {
          primary: secondary ? s.secondary : s.primary,
          secondary: secondary ? s.primary : s.secondary,
          width: s.sizes.shape,
          style: s.tool === 'line' ? 'outline' : s.shapeStyle,
        }
        gesture.current = { kind: 'shape', id: e.pointerId, tool: s.tool, start: p, end: p, ink, shown: null }
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
        // A paste that was put down: a click on it picks the whole picture up
        // again, ready to drag.
        const hit = doc.placedAt(p.x, p.y)
        const again = hit >= 0 ? doc.liftPlaced(hit) : null
        if (again) {
          s.setSelection({ x: again.x, y: again.y, width: again.canvas.width, height: again.canvas.height })
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
    }
  }

  /** With Select, a mouse over something that can be dragged shows the move cursor. */
  const hover = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = viewRef.current
    if (!el || e.pointerType !== 'mouse' || !doc.surface) return
    const s = usePaintStore.getState()
    let movable = false
    if (s.tool === 'select') {
      const p = toDoc(e.clientX, e.clientY)
      const sel = s.selection
      movable = (!!sel && p.x >= sel.x && p.y >= sel.y && p.x <= sel.x + sel.width && p.y <= sel.y + sel.height) || doc.placedAt(p.x, p.y) >= 0
    }
    el.dataset.movable = movable ? 'true' : ''
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
    if (!doc.surface) return
    if (g.kind === 'paint') {
      doc.commit(g.dirty)
    } else if (g.kind === 'shape') {
      clearPreview(g.shown)
      if (g.start.x === g.end.x && g.start.y === g.end.y) return
      doc.begin()
      const r = drawShapeTo(doc.surface.ctx, g, e.shiftKey)
      doc.commit(r)
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

      {selection && (
        <div
          className="pt-marquee pointer-events-none absolute"
          style={{
            left: panX + selection.x * zoom - 1,
            top: panY + selection.y * zoom - 1,
            width: selection.width * zoom + 2,
            height: selection.height * zoom + 2,
            cursor: 'move',
          }}
          data-floating={floating ? 'true' : undefined}
        />
      )}

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
