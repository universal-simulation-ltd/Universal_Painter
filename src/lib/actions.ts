// The things a person can ask for from more than one place — the toolbar, the
// actions menu, a keyboard shortcut, a paste — written once.
import { saveBlob } from '@unisim/media/save'
import { readDefaultView } from '@unisim/sdk'
import { doc } from './doc'
import { getT } from '../i18n/runtime'
import { encodePicture, fitWithinLimits, looksLikeImage, makeCanvas, openPicture, readClipboardPicture, saveName, writeClipboardPicture, type SaveFormat } from './imageFiles'
import { usePaintStore } from '../stores/paintStore'
import { useSettings } from '../stores/settingsStore'

/** Product code the SDK stores default views under. */
export const PRODUCT = 'painter'
/** The view row "Pictures open at" (Fit / 100%), double-tap to make default. */
export const OPENS_AT_ROW = 'opens-at'
export type OpensAt = 'fit' | 'actual'

/** The size of the area the canvas is shown in, kept by the editor. */
export const viewport = { width: 800, height: 600 }

const store = () => usePaintStore.getState()

export function fitZoom(): number {
  const w = doc.width, h = doc.height
  if (!w || !h) return 1
  const pad = viewport.width < 600 ? 16 : 48
  return Math.min(1, (viewport.width - pad) / w, (viewport.height - pad) / h)
}

/** Centre the picture at `zoom`. */
export function centreAt(zoom: number) {
  const z = Math.max(0.02, Math.min(32, zoom))
  store().setView(z, (viewport.width - doc.width * z) / 2, (viewport.height - doc.height * z) / 2)
}

export function showFit() { centreAt(fitZoom()) }
export function showActual() { centreAt(1) }

/** Zoom by `factor` about a point in the viewport (its centre by default). */
export function zoomBy(factor: number, cx = viewport.width / 2, cy = viewport.height / 2) {
  const { zoom, panX, panY } = store()
  const z = Math.max(0.02, Math.min(32, zoom * factor))
  const k = z / zoom
  store().setView(z, cx - (cx - panX) * k, cy - (cy - panY) * k)
}

/** The opening view: the person's chosen default (double-tap Fit or 100%), else Fit. */
export function showOpening() {
  const pick = readDefaultView(PRODUCT, OPENS_AT_ROW) as OpensAt | null
  if (pick === 'actual') showActual()
  else showFit()
}

// The opening view (Fit / 100%) is applied by the editor once it has measured
// the space it has: on the first picture the editor is not mounted yet.
function afterLoad() {
  const s = store()
  s.setSelection(null)
  s.setDialog(null)
}

/** Leaving unsaved work behind asks first. */
export function okToReplace(): boolean {
  if (!doc.surface || !doc.dirty) return true
  return window.confirm(getT()('app.replace_unsaved'))
}

export async function openFiles(files: File[]) {
  const t = getT()
  const file = files.find(looksLikeImage)
  if (!file) {
    if (files[0]) store().notify(t('errors.not_image', { name: files[0].name }), 'error')
    return
  }
  // A picture dropped onto an open canvas is pasted in, as Paint does;
  // otherwise it opens.
  if (doc.surface) {
    try {
      const pic = await openPicture(file)
      floatPicture(pic.canvas)
    } catch (e) {
      store().notify(e instanceof Error ? e.message : String(e), 'error')
    }
    return
  }
  await openAsNew(file)
}

export async function openAsNew(file: Blob, name?: string) {
  const t = getT()
  try {
    const pic = await openPicture(file, name)
    doc.load(pic.canvas, pic.stem)
    afterLoad()
    if (pic.scaled) {
      store().notify(t('notices.scaled', { w: pic.originalWidth, h: pic.originalHeight, sw: pic.canvas.width, sh: pic.canvas.height }))
    }
  } catch (e) {
    store().notify(e instanceof Error ? e.message : String(e), 'error')
  }
}

export function newBlank(width: number, height: number): boolean {
  const fit = fitWithinLimits(width, height)
  if (fit.scaled) {
    store().notify(getT()('dialogs.too_big', { max: new Intl.NumberFormat(getT().locale).format(16_777_216) }), 'error')
    return false
  }
  const transparent = useSettings.getState().transparentNew
  try {
    doc.blank(width, height, transparent ? null : '#ffffff', 'picture')
  } catch (e) {
    store().notify(e instanceof Error ? e.message : String(e), 'error')
    return false
  }
  afterLoad()
  return true
}

/** Put a picture on the canvas as a floating selection, near the top-left of what is on screen. */
export function floatPicture(canvas: HTMLCanvasElement) {
  const { zoom, panX, panY } = store()
  const x = Math.max(0, Math.min(doc.width - canvas.width, Math.round(-panX / zoom) + 8))
  const y = Math.max(0, Math.min(doc.height - canvas.height, Math.round(-panY / zoom) + 8))
  store().setTool('select')
  doc.float(canvas, x, y)
  const f = doc.floating
  if (f) store().setSelection({ x: f.x, y: f.y, width: f.canvas.width, height: f.canvas.height })
}

/** What Copy put away when the system clipboard refused a picture. */
let internalClipboard: HTMLCanvasElement | null = null

/** Paste from the button (not the keyboard): ask the clipboard for a picture. */
export async function pasteFromButton() {
  const t = getT()
  try {
    const blob = await readClipboardPicture()
    if (blob) {
      if (doc.surface) floatPicture((await openPicture(blob, 'pasted')).canvas)
      else await openAsNew(blob, 'pasted')
      return
    }
  } catch {
    if (!internalClipboard) { store().notify(t('notices.paste_blocked'), 'error'); return }
  }
  if (internalClipboard && doc.surface) { pasteInternal(); return }
  store().notify(t('notices.nothing_to_paste'), 'error')
}

function pasteInternal() {
  if (!internalClipboard) return
  const c = makeCanvas(internalClipboard.width, internalClipboard.height)
  c.getContext('2d')!.drawImage(internalClipboard, 0, 0)
  floatPicture(c)
}

/** A paste event (Ctrl+V / ⌘V / the browser's Paste). */
export async function pasteFromEvent(e: ClipboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
  if (file) {
    e.preventDefault()
    if (doc.surface) {
      try { floatPicture((await openPicture(file, 'pasted')).canvas) } catch (err) { store().notify(err instanceof Error ? err.message : String(err), 'error') }
    } else {
      await openAsNew(file, 'pasted')
    }
    return
  }
  if (internalClipboard && doc.surface) {
    e.preventDefault()
    pasteInternal()
  }
}

export async function copySelection(): Promise<boolean> {
  const sel = store().selection
  if (!sel || !doc.surface) return false
  const c = doc.copyRegion(sel)
  if (!c) return false
  internalClipboard = c
  const onSystem = await writeClipboardPicture(c)
  store().notify(getT()(onSystem ? 'notices.copied' : 'notices.copied_inside'))
  return true
}

export async function cutSelection() {
  if (await copySelection()) deleteSelection()
}

export function deleteSelection() {
  const sel = store().selection
  if (!sel) return
  doc.clearRegion(sel)
  store().setSelection(null)
}

export function cropToSelection() {
  const sel = store().selection
  if (!sel) return
  if (doc.floating) doc.settle()
  doc.crop(sel)
  store().setSelection(null)
  showFit()
}

export function selectAll() {
  if (!doc.surface) return
  if (doc.floating) doc.settle()
  store().setTool('select')
  store().setSelection({ x: 0, y: 0, width: doc.width, height: doc.height })
}

export function deselect() {
  if (doc.floating) doc.settle()
  store().setSelection(null)
}

export function undo() {
  doc.undo()
  store().setSelection(null)
}

export function redo() {
  doc.redo()
}

export async function save(format: SaveFormat, stem = doc.stem) {
  const t = getT()
  if (!doc.surface) return
  if (doc.floating) { doc.settle(); store().setSelection(null) }
  try {
    const quality = useSettings.getState().smallerJpeg ? 0.75 : 0.92
    const blob = await encodePicture(doc.surface.canvas, format, quality)
    const name = saveName(stem, format)
    await saveBlob(blob, name)
    doc.markSaved(stem)
    store().notify(t('notices.saved', { name }))
  } catch (e) {
    store().notify(e instanceof Error ? e.message : t('errors.save_failed'), 'error')
  }
}

/** Back to the start page, asking first when there are unsaved changes. */
export function closePicture(): boolean {
  if (doc.surface && doc.dirty && !window.confirm(getT()('app.close_unsaved'))) return false
  doc.close()
  store().setSelection(null)
  store().setDialog(null)
  return true
}
