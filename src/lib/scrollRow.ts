// A row that scrolls sideways shows it scrolls (BRANDING.md, owner rule
// 2026-10-18): one item is cut off at the edge, and the edge with more beyond
// it fades. No nudge (dropped 2026-10-19).
//
// `useScrollHint` is copied from Universal_PDF/src/native/parts.tsx (the
// suite's reference implementation; BRANDING.md says to move it into the SDK
// when a second product needs it — Painter is that second product, and it is
// copied rather than moved so this app stays self-contained; the SDK move is
// left for whoever touches the SDK next).
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

export function useScrollHint<T extends HTMLElement>(): { ref: RefObject<T>; style: CSSProperties } {
  const ref = useRef<T>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth
      setEdges({ start: el.scrollLeft > 2, end: el.scrollLeft < max - 2 })
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [])

  const FADE = 28
  const mask =
    edges.start || edges.end
      ? `linear-gradient(to right, ${edges.start ? 'transparent' : '#000'} 0, #000 ${edges.start ? FADE : 0}px, #000 calc(100% - ${edges.end ? FADE : 0}px), ${edges.end ? 'transparent' : '#000'} 100%)`
      : undefined
  return { ref, style: mask ? { maskImage: mask, WebkitMaskImage: mask } : {} }
}

/**
 * The width that leaves one button cut in half at the edge: "five and a half
 * across, not exactly five". Only when the row overflows; a row that fits
 * keeps `base`. `count` is how many equal buttons the row holds and `fixed`
 * the width of everything else in it.
 */
export function useCutOffWidth(ref: RefObject<HTMLElement>, base: number, count: number, fixed = 0): number {
  const [width, setWidth] = useState(base)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const room = el.clientWidth - fixed
      if (count * base <= room) { setWidth(base); return }
      const n = Math.max(1, Math.floor(room / base - 0.5))
      setWidth(Math.max(40, room / (n + 0.5)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, base, count, fixed])
  return width
}
