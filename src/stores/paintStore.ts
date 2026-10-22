import { create } from 'zustand'
import type { Rect } from '../lib/pixels'

export type Tool =
  | 'pencil'
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'line'
  | 'box'
  | 'ellipse'
  | 'text'
  | 'picker'
  | 'select'
  | 'hand'

export const TOOLS: Tool[] = ['pencil', 'brush', 'eraser', 'fill', 'line', 'box', 'ellipse', 'text', 'picker', 'select', 'hand']

/** Outline only, filled only, or an outline in the first colour round a fill in the second. */
export type ShapeStyle = 'outline' | 'fill' | 'both'

export type Dialog = null | 'new' | 'resize' | 'canvas' | 'adjust' | 'image' | 'save'

/** The 28 colours of the palette: Paint's own idea, in the suite's tones. */
export const PALETTE = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fe8c01', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#0f172a', '#e05504', '#8b5a2b',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#f472b6', '#64748b', '#fed7aa', '#14b8a6',
]

interface PaintState {
  tool: Tool
  /** The tool to go back to after the eyedropper picks a colour. */
  lastTool: Tool
  primary: string
  secondary: string
  /** Line width in picture pixels, per family of tool. */
  sizes: { pencil: number; brush: number; eraser: number; shape: number }
  shapeStyle: ShapeStyle
  /** Fill bucket: how different a colour may be and still be filled (0–100). */
  tolerance: number
  fontSize: number
  bold: boolean
  /** The rectangle drawn with the select tool, in picture pixels. */
  selection: Rect | null
  zoom: number
  panX: number
  panY: number
  dialog: Dialog
  /** A short line at the foot of the canvas ("Copied", an error). */
  notice: { text: string; tone: 'info' | 'error'; at: number } | null

  setTool: (tool: Tool) => void
  setPrimary: (c: string) => void
  setSecondary: (c: string) => void
  swapColours: () => void
  setSize: (which: keyof PaintState['sizes'], n: number) => void
  setShapeStyle: (s: ShapeStyle) => void
  setTolerance: (n: number) => void
  setFontSize: (n: number) => void
  setBold: (b: boolean) => void
  setSelection: (r: Rect | null) => void
  setView: (zoom: number, panX: number, panY: number) => void
  setDialog: (d: Dialog) => void
  notify: (text: string, tone?: 'info' | 'error') => void
  /** Back to the colours and sizes a first visit has (Reset to defaults). */
  resetTools: () => void
}

const TOOL_DEFAULTS = {
  tool: 'brush' as Tool,
  lastTool: 'brush' as Tool,
  primary: '#000000',
  secondary: '#ffffff',
  sizes: { pencil: 1, brush: 8, eraser: 24, shape: 4 },
  shapeStyle: 'outline' as ShapeStyle,
  tolerance: 20,
  fontSize: 32,
  bold: false,
}

export const usePaintStore = create<PaintState>((set) => ({
  ...TOOL_DEFAULTS,
  selection: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  dialog: null,
  notice: null,

  setTool: (tool) => set((s) => ({ tool, lastTool: tool === 'picker' ? s.tool : tool, selection: tool === 'select' ? s.selection : null })),
  setPrimary: (primary) => set({ primary }),
  setSecondary: (secondary) => set({ secondary }),
  swapColours: () => set((s) => ({ primary: s.secondary, secondary: s.primary })),
  setSize: (which, n) => set((s) => ({ sizes: { ...s.sizes, [which]: n } })),
  setShapeStyle: (shapeStyle) => set({ shapeStyle }),
  setTolerance: (tolerance) => set({ tolerance }),
  setFontSize: (fontSize) => set({ fontSize }),
  setBold: (bold) => set({ bold }),
  setSelection: (selection) => set({ selection }),
  setView: (zoom, panX, panY) => set({ zoom, panX, panY }),
  setDialog: (dialog) => set({ dialog }),
  notify: (text, tone = 'info') => set({ notice: { text, tone, at: Date.now() } }),
  resetTools: () => set({ ...TOOL_DEFAULTS, sizes: { ...TOOL_DEFAULTS.sizes } }),
}))

/** Which size slider a tool uses, or null for tools without one. */
export function sizeKey(tool: Tool): keyof PaintState['sizes'] | null {
  if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') return tool
  if (tool === 'line' || tool === 'box' || tool === 'ellipse') return 'shape'
  return null
}
