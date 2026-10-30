// Undo and redo for one canvas, by swapping rather than copying.
//
// An entry holds the OTHER state of what it changed — never both. Undo swaps
// the entry's pixels with the canvas's current ones and moves it to the redo
// stack; redo swaps them back. So a brush stroke costs one copy of the
// rectangle it touched, and a rotate costs one spare canvas (the old one, kept
// whole), instead of before AND after of each.
//
// Kept to a memory budget rather than a step count: forty strokes across a
// small doodle cost almost nothing, while three rotations of a 12-megapixel
// photo are 150 MB. The oldest entries go first; the newest always stays.
//
// Each entry also carries the OTHER list of movable objects (objects.ts), so
// undo and redo bring back what could be picked up, not only the pixels.
import type { Rect } from './pixels'
import type { Item } from './objects'

export type Entry =
  | { kind: 'patch'; rect: Rect; data: ImageData; items: Item[] }
  | { kind: 'whole'; canvas: HTMLCanvasElement; items: Item[] }

export interface Surface {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

const bytes = (e: Entry) =>
  e.kind === 'patch' ? e.data.width * e.data.height * 4 : e.canvas.width * e.canvas.height * 4

export class History {
  private undoStack: Entry[] = []
  private redoStack: Entry[] = []
  constructor(private budget: number) {}

  get canUndo() { return this.undoStack.length > 0 }
  get canRedo() { return this.redoStack.length > 0 }
  get size() { return this.undoStack.length }

  push(entry: Entry): void {
    this.undoStack.push(entry)
    this.drop(this.redoStack.splice(0))
    let total = this.undoStack.reduce((n, e) => n + bytes(e), 0)
    while (total > this.budget && this.undoStack.length > 1) {
      const old = this.undoStack.shift()!
      total -= bytes(old)
      this.drop([old])
    }
  }

  /** Swap the newest entry back in. Returns the surface and the objects to show next. */
  undo(s: Surface, items: Item[]): { surface: Surface; items: Item[] } {
    const e = this.undoStack.pop()
    if (!e) return { surface: s, items }
    const next = swap(e, s, items)
    this.redoStack.push(e)
    return next
  }

  redo(s: Surface, items: Item[]): { surface: Surface; items: Item[] } {
    const e = this.redoStack.pop()
    if (!e) return { surface: s, items }
    const next = swap(e, s, items)
    this.undoStack.push(e)
    return next
  }

  clear(): void {
    this.drop(this.undoStack.splice(0))
    this.drop(this.redoStack.splice(0))
  }

  /** Release the canvases an entry held — on iOS canvas memory is a small fixed pool. */
  private drop(entries: Entry[]) {
    for (const e of entries) {
      if (e.kind === 'whole') {
        e.canvas.width = 0
        e.canvas.height = 0
      }
    }
  }
}

function swap(e: Entry, s: Surface, items: Item[]): { surface: Surface; items: Item[] } {
  const back = e.items
  e.items = items
  if (e.kind === 'patch') {
    const { x, y, width, height } = e.rect
    const now = s.ctx.getImageData(x, y, width, height)
    s.ctx.putImageData(e.data, x, y)
    e.data = now
    return { surface: s, items: back }
  }
  const now = s.canvas
  const canvas = e.canvas
  e.canvas = now
  return { surface: { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true })! }, items: back }
}
