// Pixel maths with no DOM: the fill bucket, the photo adjustments, and the
// rectangle helpers. Pure functions over RGBA byte arrays, so vitest can prove
// them under Node without a browser.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type RGBA = [number, number, number, number]

/** `#rrggbb` (or `#rgb`) → [r, g, b, 255]. Anything else is black. */
export function parseHex(hex: string): RGBA {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = Number.parseInt(h.slice(0, 6), 16)
  if (!Number.isFinite(n) || h.length < 6) return [0, 0, 0, 255]
  const a = h.length >= 8 ? Number.parseInt(h.slice(6, 8), 16) : 255
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
}

export function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Flood-fill from (x, y) with `color`, replacing every connected pixel within
 * `tolerance` (0–100: 0 = exactly the same colour, 100 = everything) of the
 * starting pixel. Scanline, four-way, in place. Returns the bounding box of the
 * pixels it changed, or null when it changed none (clicking a colour with the
 * same colour).
 */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RGBA,
  tolerance: number,
): Rect | null {
  x = Math.floor(x)
  y = Math.floor(y)
  if (x < 0 || y < 0 || x >= width || y >= height) return null
  const at = (y * width + x) * 4
  const sr = data[at], sg = data[at + 1], sb = data[at + 2], sa = data[at + 3]
  const [fr, fg, fb, fa] = color
  if (sr === fr && sg === fg && sb === fb && sa === fa) return null
  // Tolerance as a distance in RGBA space; 100 reaches the far corner.
  const limit = (Math.max(0, Math.min(100, tolerance)) / 100) * 510 // sqrt(4 * 255²) = 510
  const limitSq = limit * limit
  const matches = (i: number) => {
    const dr = data[i] - sr, dg = data[i + 1] - sg, db = data[i + 2] - sb, da = data[i + 3] - sa
    return dr * dr + dg * dg + db * db + da * da <= limitSq
  }
  const seen = new Uint8Array(width * height)
  let minX = x, maxX = x, minY = y, maxY = y
  const stack: number[] = [x, y]
  while (stack.length) {
    const py = stack.pop()!
    let px = stack.pop()!
    // Walk left to the start of this run.
    while (px > 0 && !seen[py * width + px - 1] && matches((py * width + px - 1) * 4)) px--
    let spanUp = false
    let spanDown = false
    for (; px < width; px++) {
      const p = py * width + px
      if (seen[p] || !matches(p * 4)) break
      seen[p] = 1
      const i = p * 4
      data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = fa
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
      if (py > 0) {
        const up = p - width
        const ok = !seen[up] && matches(up * 4)
        if (ok && !spanUp) { stack.push(px, py - 1); spanUp = true } else if (!ok) spanUp = false
      }
      if (py < height - 1) {
        const down = p + width
        const ok = !seen[down] && matches(down * 4)
        if (ok && !spanDown) { stack.push(px, py + 1); spanDown = true } else if (!ok) spanDown = false
      }
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/**
 * Brightness (−100…100) and contrast (−100…100), in place. Brightness shifts
 * every channel; contrast stretches it about the middle grey, the curve most
 * simple editors use. Transparency is left alone.
 */
export function brightnessContrast(data: Uint8ClampedArray, brightness: number, contrast: number): void {
  const b = (brightness / 100) * 255
  const c = (Math.max(-100, Math.min(100, contrast)) / 100) * 255
  const f = (259 * (c + 255)) / (255 * (259 - c))
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) lut[v] = f * (v + b - 128) + 128
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]]
    data[i + 1] = lut[data[i + 1]]
    data[i + 2] = lut[data[i + 2]]
  }
}

/** Greyscale by perceived brightness (Rec. 709), in place. */
export function greyscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    data[i] = data[i + 1] = data[i + 2] = y
  }
}

/** Every colour to its opposite, in place (Paint's "Invert colours"). */
export function invert(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]
    data[i + 1] = 255 - data[i + 1]
    data[i + 2] = 255 - data[i + 2]
  }
}

/** A rectangle from two corners, whichever way it was dragged. */
export function rectFromPoints(ax: number, ay: number, bx: number, by: number): Rect {
  const x = Math.min(ax, bx)
  const y = Math.min(ay, by)
  return { x, y, width: Math.abs(bx - ax), height: Math.abs(by - ay) }
}

/** Whole pixels, inside a w × h picture; null when nothing is left. */
export function clampRect(r: Rect, w: number, h: number): Rect | null {
  const x0 = Math.max(0, Math.floor(r.x))
  const y0 = Math.max(0, Math.floor(r.y))
  const x1 = Math.min(w, Math.ceil(r.x + r.width))
  const y1 = Math.min(h, Math.ceil(r.y + r.height))
  if (x1 - x0 < 1 || y1 - y0 < 1) return null
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

/** Where the old picture lands when the canvas becomes newW × newH, by anchor (0–8, reading order). */
export function anchorOffset(anchor: number, oldW: number, oldH: number, newW: number, newH: number): { dx: number; dy: number } {
  const col = anchor % 3
  const row = Math.floor(anchor / 3)
  const dx = col === 0 ? 0 : col === 1 ? Math.round((newW - oldW) / 2) : newW - oldW
  const dy = row === 0 ? 0 : row === 1 ? Math.round((newH - oldH) / 2) : newH - oldH
  return { dx, dy }
}

/** Snap a drag to the nearest 45° (Shift on a line). */
export function snap45(ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
  const dx = bx - ax
  const dy = by - ay
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const len = Math.hypot(dx, dy)
  return { x: ax + Math.cos(angle) * len, y: ay + Math.sin(angle) * len }
}

/** Make a drag square (Shift on a box or an ellipse). */
export function squareUp(ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
  const side = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
  return { x: ax + Math.sign(bx - ax || 1) * side, y: ay + Math.sign(by - ay || 1) * side }
}
