import { create } from 'zustand'

// The options in Tune this app. Every one starts UNTICKED (the suite rule,
// 2026-09-16): each is worded so that unticked is how Painter behaves out of the
// box, and ticking it changes something.
//
// Stored on this device only (localStorage), never with an account: Painter
// has no accounts.
export interface Settings {
  /** Only a pen (Apple Pencil, stylus) draws; fingers move and zoom the canvas. */
  penOnly: boolean
  /** Draw every pen line at full width, whatever the pressure. */
  ignorePressure: boolean
  /** Save JPEGs at a lower quality, for smaller files. */
  smallerJpeg: boolean
  /** New canvases start see-through rather than white. */
  transparentNew: boolean
  /** A grid between the pixels when zoomed in to 8× and closer. */
  pixelGrid: boolean
}

const KEY = 'unisim-painter-settings'

export const SETTING_DEFAULTS: Settings = {
  penOnly: false,
  ignorePressure: false,
  smallerJpeg: false,
  transparentNew: false,
  pixelGrid: false,
}

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...SETTING_DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch { /* private mode: defaults */ }
  return { ...SETTING_DEFAULTS }
}

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  reset: () => void
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...read(),
  set: (key, value) => {
    set({ [key]: value } as Partial<SettingsState>)
    const s = get()
    const out: Settings = {
      penOnly: s.penOnly,
      ignorePressure: s.ignorePressure,
      smallerJpeg: s.smallerJpeg,
      transparentNew: s.transparentNew,
      pixelGrid: s.pixelGrid,
    }
    try { localStorage.setItem(KEY, JSON.stringify(out)) } catch { /* not kept */ }
  },
  reset: () => {
    set({ ...SETTING_DEFAULTS })
    try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
  },
}))
