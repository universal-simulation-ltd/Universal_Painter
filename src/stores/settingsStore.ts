import { createSyncedSettings } from '@unisim/sdk'

// The options in Tune this app. Every one starts UNTICKED (the suite rule,
// 2026-09-16): each is worded so that unticked is how Painter behaves out of the
// box, and ticking it changes something.
//
// Stored on this device (localStorage) and — when someone has signed in from
// Tune this app — on their account too (James, 2026-10-30: "mobile app and web
// app settings in tune this app should be saved and synced to their account …
// Global rule"). An SDK synced store (`createSyncedSettings`, @unisim/sdk
// 0.232.0): the SDK provider carries it to the account's `tune-app:painter`
// row, newest change wins; signed out (Painter's usual way) it stays here.
// Same key and shape as before, so nobody's ticks are lost.
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

export function normaliseSettings(raw: unknown): Settings {
  const r = raw && typeof raw === 'object' ? (raw as Partial<Settings>) : {}
  return {
    penOnly: r.penOnly === true,
    ignorePressure: r.ignorePressure === true,
    smallerJpeg: r.smallerJpeg === true,
    transparentNew: r.transparentNew === true,
    pixelGrid: r.pixelGrid === true,
  }
}

export const painterSettings = createSyncedSettings<Settings>('painter', SETTING_DEFAULTS, normaliseSettings, { storageKey: KEY })

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  /** Tune this app ▸ Reset to defaults (the SDK's reset reaches it too). */
  reset: () => void
}

const actions = {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => painterSettings.set({ [key]: value } as Partial<Settings>),
  reset: () => painterSettings.reset(),
}

function useSettingsSlice<U>(selector: (s: SettingsState) => U): U {
  return painterSettings((s) => selector({ ...s, ...actions }))
}

/** The zustand-style view the editor uses: values and setters together. */
export const useSettings = Object.assign(useSettingsSlice, {
  getState: (): SettingsState => ({ ...painterSettings.getState(), ...actions }),
})
