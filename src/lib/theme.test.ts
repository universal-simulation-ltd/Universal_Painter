import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The theme key is written down TWICE, and this is what stops the two drifting.
//
// `src/stores/themeStore.ts` names it for the SDK's store; `index.html` names it
// again in the inline script that puts `.dark` on `<html>` before the first
// paint, which is the only place early enough to matter (the store applies the
// same class, but not until the module bundle has parsed). There is no way to
// share one constant between a bundled module and a script that must run during
// head parsing — so instead, renaming either without the other fails here.
//
// It is not a style rule. The key IS every user's saved choice for this app (since
// SDK 0.143, their override of the global colour scheme): change it and everybody
// who chose dark here is silently back to following global.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8')

/** The key as the store declares it: `createThemeStore('…')`. */
function storeKey(): string {
  const match = /createThemeStore\('([^']+)'\)/.exec(read('src/stores/themeStore.ts'))
  if (!match) throw new Error('themeStore.ts no longer calls createThemeStore with a literal key')
  return match[1]
}

/** The `<head>` script, i.e. everything before the module bundle can run. */
function headScript(): string {
  const html = read('index.html')
  return html.slice(0, html.indexOf('</head>'))
}

describe('the pre-paint theme script', () => {
  it('reads the same localStorage key as the theme store', () => {
    expect(headScript()).toContain(`localStorage.getItem('${storeKey()}')`)
  })

  // Since SDK 0.143 an absent app key means "follow Global preferences". Without
  // this fallback someone whose only choice is the global Dark gets a light first
  // frame and then a flip once the store loads.
  it('falls back to the global colour scheme, then to light', () => {
    expect(headScript()).toMatch(
      new RegExp(`localStorage\\.getItem\\('${storeKey()}'\\)\\s*\\|\\|\\s*localStorage\\.getItem\\('universal:color-scheme'\\)\\s*\\|\\|\\s*'light'`),
    )
  })

  it('puts the dark class on <html> before anything is painted', () => {
    const head = headScript()
    expect(head).toContain("classList.add('dark')")
    // 'system' has to be honoured here too, or somebody on the OS setting gets
    // the light ground first and the dark one once the bundle catches up.
    expect(head).toContain('prefers-color-scheme: dark')
  })

  it('never removes the class — light is the default, so it only ever adds', () => {
    expect(headScript()).not.toContain("classList.remove('dark')")
  })
})
