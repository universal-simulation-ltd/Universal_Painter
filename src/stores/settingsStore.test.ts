import { beforeAll, describe, expect, it, vi } from 'vitest'

// Tune this app's ticks on the SDK's synced store (@unisim/sdk 0.232.0
// createSyncedSettings): same key and shape as before, so an existing
// person's ticks are read as they were; every tick starts unticked; a bad
// stored value reads as unticked; Reset puts them all back.

const store = new Map<string, string>([
  ['unisim-painter-settings', JSON.stringify({ penOnly: true, smallerJpeg: 'yes', pixelGrid: true })],
])

type Mod = typeof import('./settingsStore')
let mod: Mod

beforeAll(async () => {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
    },
    addEventListener: () => {},
  })
  mod = await import('./settingsStore')
})

describe('Painter settings', () => {
  it('starts every tick unticked', () => {
    expect(Object.values(mod.SETTING_DEFAULTS).every((v) => v === false)).toBe(true)
    expect(mod.normaliseSettings(undefined)).toEqual(mod.SETTING_DEFAULTS)
  })

  it('reads an existing person’s ticks from the old key, junk as unticked', () => {
    expect(mod.useSettings.getState()).toMatchObject({ penOnly: true, smallerJpeg: false, pixelGrid: true, ignorePressure: false })
  })

  it('saves a tick in the same flat shape', () => {
    mod.useSettings.getState().set('transparentNew', true)
    expect(JSON.parse(store.get('unisim-painter-settings')!)).toEqual({
      penOnly: true, ignorePressure: false, smallerJpeg: false, transparentNew: true, pixelGrid: true,
    })
  })

  it('Reset to defaults puts them all back', () => {
    mod.useSettings.getState().reset()
    expect(mod.useSettings.getState()).toMatchObject(mod.SETTING_DEFAULTS)
    expect(JSON.parse(store.get('unisim-painter-settings')!)).toEqual(mod.SETTING_DEFAULTS)
  })
})
