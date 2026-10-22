// Opening and saving pictures. Everything here runs in the browser: a picture
// is read from the file the person chose (or pasted) and written back out as a
// download; nothing is uploaded.
//
// ⚠️ REUSED FROM UNIVERSAL IMAGES BY COPY (decided 2026-10-22). Painter is
// self-contained: rather than a shared package or a link out to Images, the
// parts Images has already proven on real phones are copied here, each marked
// with its source. Fix a bug in one, check the other.
//
//   isHeicByName, head, isHeic, decodeHeicIfNeeded
//       ← Universal_Images/src/lib/imageResize.ts (HEIC via `heic-to`)
//   stepDown (high-quality downscale in halves)
//       ← Universal_Images/src/lib/imageResize.ts
//   flattenOnto + the JPEG-on-white rule in encodeCanvas
//       ← Universal_Images/src/lib/imageResize.ts
import { heicFromBytes } from './heicSniff'
import { getT } from '../i18n/runtime'

/**
 * The largest picture Painter will hold, in pixels. WebKit refuses a canvas
 * over 16,777,216 pixels (4096 × 4096) — getContext comes back null and every
 * later step fails with "null is not an object" — so a bigger picture is
 * scaled down to fit when it is opened, and the person is told.
 */
export const MAX_PIXELS = 16_777_216
/** No side longer than this, whatever the area (Chrome's own limit is 32767). */
export const MAX_SIDE = 16_384

const HEIC_EXT_RE = /\.(heic|heif)$/i
const HEIC_MIME = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])

// ── Copied from Universal_Images/src/lib/imageResize.ts ─────────────────────
function isHeicByName(file: File) {
  return HEIC_MIME.has(file.type.toLowerCase()) || HEIC_EXT_RE.test(file.name)
}

async function head(file: File, n = 32): Promise<Uint8Array> {
  if (file.size === 0) throw new Error(getT()('errors.empty_file', { name: file.name }))
  try {
    return new Uint8Array(await file.slice(0, n).arrayBuffer())
  } catch {
    throw new Error(getT()('errors.unreadable', { name: file.name }))
  }
}

async function isHeic(file: File): Promise<boolean> {
  return isHeicByName(file) || heicFromBytes(await head(file))
}

/**
 * HEIC/HEIF (iPhone) → PNG pixels, through `heic-to` (libheif 1.19), NOT
 * heic2any, which fails on every photo a current iPhone takes. Checked before
 * any native decode so Safari takes the same path as every other browser. The
 * decoder is ~3 MB, so it is loaded on the first HEIC only and kept out of the
 * PWA precache (vite.config.ts `globIgnores`). Images converts to JPEG because
 * it shows a file size; Painter only wants pixels, so it asks for PNG and loses
 * nothing.
 */
async function decodeHeicIfNeeded(file: File): Promise<Blob> {
  if (!(await isHeic(file))) return file
  const { heicTo } = await import('heic-to')
  try {
    return await heicTo({ blob: file, type: 'image/png' })
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    throw new Error(getT()('errors.heic', { why }))
  }
}

/** Halve repeatedly, then one last draw: a sharp downscale without a library. */
export function stepDown(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  let from: CanvasImageSource = source
  let fx = sx
  let fy = sy
  let currentW = sw
  let currentH = sh
  let previous: HTMLCanvasElement | null = null

  const draw = (w: number, h: number): HTMLCanvasElement => {
    const next = makeCanvas(w, h)
    const ctx = next.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(from, fx, fy, currentW, currentH, 0, 0, w, h)
    if (previous && previous !== source) {
      previous.width = 0
      previous.height = 0
    }
    previous = next
    from = next
    fx = 0
    fy = 0
    currentW = w
    currentH = h
    return next
  }

  let canvas: HTMLCanvasElement | null = null
  while (currentW >= targetW * 2 && currentH >= targetH * 2) {
    canvas = draw(Math.max(Math.round(currentW / 2), targetW), Math.max(Math.round(currentH / 2), targetH))
  }
  if (canvas && currentW === targetW && currentH === targetH) return canvas
  return draw(targetW, targetH)
}

/** Paint `color` beneath whatever the canvas holds, flattening transparency. */
function flattenOnto(canvas: HTMLCanvasElement, color: string) {
  const ctx = canvas.getContext('2d')!
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'
}
// ── end of the copied part ──────────────────────────────────────────────────

/** A blank canvas, or a refusal that says why rather than a later null. */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  // willReadFrequently: the fill bucket, the eyedropper and undo all read
  // pixels back, which is slow on a GPU-backed canvas.
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error(getT()('errors.too_big_canvas', { w: c.width, h: c.height }))
  return c
}

/** The size a w × h picture must shrink to so it fits the limits above. */
export function fitWithinLimits(w: number, h: number): { width: number; height: number; scaled: boolean } {
  let k = 1
  if (w * h > MAX_PIXELS) k = Math.min(k, Math.sqrt(MAX_PIXELS / (w * h)))
  if (Math.max(w, h) * k > MAX_SIDE) k = Math.min(k, MAX_SIDE / Math.max(w, h))
  if (k >= 1) return { width: w, height: h, scaled: false }
  return { width: Math.max(1, Math.floor(w * k)), height: Math.max(1, Math.floor(h * k)), scaled: true }
}

const NAME_IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i

/** Is this something Painter can open? By type, then by name (HEIC has none on Windows). */
export function looksLikeImage(file: File): boolean {
  return file.type.startsWith('image/') || NAME_IMAGE_RE.test(file.name) || file.type === ''
}

export interface OpenedPicture {
  canvas: HTMLCanvasElement
  /** The file name without its extension, for the saved copy. */
  stem: string
  /** True when it was too big and was scaled down to fit. */
  scaled: boolean
  originalWidth: number
  originalHeight: number
}

/** Decode a picture into a canvas at its own size (or the largest that fits). */
export async function openPicture(file: File | Blob, name = 'picture'): Promise<OpenedPicture> {
  const fileName = file instanceof File ? file.name : name
  const asFile = file instanceof File ? file : new File([file], fileName, { type: file.type })
  const usable = await decodeHeicIfNeeded(asFile)
  let bitmap: ImageBitmap
  try {
    // `imageOrientation: 'from-image'` turns a sideways phone JPEG upright, as
    // every photo viewer shows it.
    bitmap = await createImageBitmap(usable, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(getT()('errors.cannot_decode', { name: fileName }))
  }
  const { width, height, scaled } = fitWithinLimits(bitmap.width, bitmap.height)
  let canvas: HTMLCanvasElement
  if (scaled) {
    canvas = stepDown(bitmap, 0, 0, bitmap.width, bitmap.height, width, height)
    // stepDown's canvases are made without willReadFrequently; copy into one that is.
    const c = makeCanvas(width, height)
    c.getContext('2d')!.drawImage(canvas, 0, 0)
    canvas.width = 0
    canvas = c
  } else {
    canvas = makeCanvas(width, height)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  }
  const result = { canvas, stem: stemOf(fileName), scaled, originalWidth: bitmap.width, originalHeight: bitmap.height }
  bitmap.close()
  return result
}

export function stemOf(name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = (dot > 0 ? name.slice(0, dot) : name).trim()
  return stem || 'picture'
}

export type SaveFormat = 'image/png' | 'image/jpeg'

/**
 * Encode the picture. JPEG has no transparency, and an encoder writes a
 * see-through pixel as black, so a JPEG is flattened onto white first — on a
 * copy, never the picture being edited.
 */
export function encodePicture(source: HTMLCanvasElement, format: SaveFormat, quality = 0.92): Promise<Blob> {
  let canvas = source
  if (format === 'image/jpeg') {
    canvas = makeCanvas(source.width, source.height)
    canvas.getContext('2d')!.drawImage(source, 0, 0)
    flattenOnto(canvas, '#ffffff')
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (canvas !== source) {
          canvas.width = 0
          canvas.height = 0
        }
        if (blob) resolve(blob)
        else reject(new Error(getT()('errors.save_failed')))
      },
      format,
      format === 'image/png' ? undefined : quality,
    )
  })
}

export function saveName(stem: string, format: SaveFormat): string {
  return `${stem}.${format === 'image/png' ? 'png' : 'jpg'}`
}

/** The first picture on the clipboard, or null. Needs a user gesture and permission. */
export async function readClipboardPicture(): Promise<Blob | null> {
  if (!navigator.clipboard?.read) return null
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) return item.getType(type)
  }
  return null
}

/** Put a canvas region on the system clipboard as a PNG, where the browser allows it. */
export async function writeClipboardPicture(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false
    // Safari wants the promise handed to ClipboardItem inside the gesture.
    const blob = new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/png'),
    )
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
