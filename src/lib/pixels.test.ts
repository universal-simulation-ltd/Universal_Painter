import { describe, expect, it } from 'vitest'
import { anchorOffset, brightnessContrast, clampRect, floodFill, greyscale, invert, parseHex, rectFromPoints, snap45, squareUp, toHex, unionRect } from './pixels'

/** A w × h picture, every pixel `rgba`. */
function picture(w: number, h: number, rgba: [number, number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < d.length; i += 4) d.set(rgba, i)
  return d
}
const px = (d: Uint8ClampedArray, w: number, x: number, y: number) => Array.from(d.slice((y * w + x) * 4, (y * w + x) * 4 + 4))

describe('floodFill', () => {
  it('fills a plain picture edge to edge and reports the box it changed', () => {
    const d = picture(5, 4, [255, 255, 255, 255])
    const r = floodFill(d, 5, 4, 2, 2, [255, 0, 0, 255], 0)
    expect(r).toEqual({ x: 0, y: 0, width: 5, height: 4 })
    expect(px(d, 5, 0, 0)).toEqual([255, 0, 0, 255])
    expect(px(d, 5, 4, 3)).toEqual([255, 0, 0, 255])
  })

  it('stops at a wall, and does not leak through a diagonal gap', () => {
    // A black vertical wall at x = 2 splits a 5 × 3 white picture in two.
    const w = 5, h = 3
    const d = picture(w, h, [255, 255, 255, 255])
    for (let y = 0; y < h; y++) d.set([0, 0, 0, 255], (y * w + 2) * 4)
    const r = floodFill(d, w, h, 0, 1, [0, 0, 255, 255], 10)
    expect(r).toEqual({ x: 0, y: 0, width: 2, height: 3 })
    expect(px(d, w, 1, 1)).toEqual([0, 0, 255, 255])
    expect(px(d, w, 2, 1)).toEqual([0, 0, 0, 255])
    expect(px(d, w, 3, 1)).toEqual([255, 255, 255, 255])
  })

  it('takes near colours within the tolerance and leaves far ones', () => {
    const w = 3, h = 1
    const d = picture(w, h, [200, 200, 200, 255])
    d.set([190, 190, 190, 255], 4) // close
    d.set([20, 20, 20, 255], 8) // far
    floodFill(d, w, h, 0, 0, [0, 255, 0, 255], 10)
    expect(px(d, w, 1, 0)).toEqual([0, 255, 0, 255])
    expect(px(d, w, 2, 0)).toEqual([20, 20, 20, 255])
  })

  it('does nothing when the area is already that colour, or off the picture', () => {
    const d = picture(2, 2, [1, 2, 3, 255])
    expect(floodFill(d, 2, 2, 0, 0, [1, 2, 3, 255], 50)).toBeNull()
    expect(floodFill(d, 2, 2, 5, 5, [9, 9, 9, 255], 50)).toBeNull()
  })

  it('fills see-through pixels too (a transparent canvas)', () => {
    const d = picture(3, 3, [0, 0, 0, 0])
    floodFill(d, 3, 3, 1, 1, [10, 20, 30, 255], 0)
    expect(px(d, 3, 2, 2)).toEqual([10, 20, 30, 255])
  })

  it('handles a large picture without overflowing the stack', () => {
    const w = 1500, h = 1500
    const d = picture(w, h, [255, 255, 255, 255])
    const r = floodFill(d, w, h, 750, 750, [0, 0, 0, 255], 0)
    expect(r).toEqual({ x: 0, y: 0, width: w, height: h })
  })
})

describe('adjustments', () => {
  it('greyscale keeps white white and black black, and equalises the channels', () => {
    const d = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 128])
    greyscale(d)
    expect(Array.from(d.slice(0, 4))).toEqual([255, 255, 255, 255])
    expect(Array.from(d.slice(4, 8))).toEqual([0, 0, 0, 255])
    expect(d[8]).toBe(d[9])
    expect(d[9]).toBe(d[10])
    expect(d[11]).toBe(128) // transparency untouched
  })

  it('brightness 0 / contrast 0 leaves the picture as it was', () => {
    const d = new Uint8ClampedArray([10, 128, 250, 255])
    brightnessContrast(d, 0, 0)
    expect(Array.from(d)).toEqual([10, 128, 250, 255])
  })

  it('brightness lifts every channel; contrast pushes away from the middle', () => {
    const d = new Uint8ClampedArray([100, 100, 100, 255])
    brightnessContrast(d, 20, 0)
    expect(d[0]).toBeGreaterThan(100)
    const e = new Uint8ClampedArray([100, 160, 128, 255])
    brightnessContrast(e, 0, 50)
    expect(e[0]).toBeLessThan(100)
    expect(e[1]).toBeGreaterThan(160)
  })

  it('invert flips the colour and keeps the transparency', () => {
    const d = new Uint8ClampedArray([0, 100, 255, 7])
    invert(d)
    expect(Array.from(d)).toEqual([255, 155, 0, 7])
  })
})

describe('geometry', () => {
  it('rectangles from two corners either way round', () => {
    expect(rectFromPoints(10, 10, 4, 2)).toEqual({ x: 4, y: 2, width: 6, height: 8 })
  })

  it('clamps to the picture in whole pixels, or gives null', () => {
    expect(clampRect({ x: -5, y: 2.4, width: 20, height: 3 }, 10, 10)).toEqual({ x: 0, y: 2, width: 10, height: 4 })
    expect(clampRect({ x: 20, y: 20, width: 5, height: 5 }, 10, 10)).toBeNull()
  })

  it('unions boxes', () => {
    expect(unionRect({ x: 0, y: 0, width: 2, height: 2 }, { x: 5, y: 5, width: 1, height: 1 })).toEqual({ x: 0, y: 0, width: 6, height: 6 })
    expect(unionRect(null, { x: 1, y: 1, width: 1, height: 1 })).toEqual({ x: 1, y: 1, width: 1, height: 1 })
  })

  it('anchors a canvas resize: top-left, centre, bottom-right', () => {
    expect(anchorOffset(0, 10, 10, 20, 30)).toEqual({ dx: 0, dy: 0 })
    expect(anchorOffset(4, 10, 10, 20, 30)).toEqual({ dx: 5, dy: 10 })
    expect(anchorOffset(8, 10, 10, 20, 30)).toEqual({ dx: 10, dy: 20 })
  })

  it('snaps a line to 45° and squares a box', () => {
    const p = snap45(0, 0, 10, 1)
    expect(Math.round(p.y)).toBe(0)
    expect(squareUp(0, 0, 10, -4)).toEqual({ x: 10, y: -10 })
  })

  it('reads and writes hex colours', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0, 255])
    expect(parseHex('#fff')).toEqual([255, 255, 255, 255])
    expect(toHex(255, 128, 0)).toBe('#ff8000')
  })
})
