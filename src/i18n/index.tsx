/* eslint-disable react-refresh/only-export-components -- the translator hooks and helpers belong with I18nRoot; hot reload of this one file is not worth splitting it */
// The app's own translations — the same setup as Universal QR's, Universal PDF's and Universal Jukebox's
// PDF's src/i18n.
//
// The SDK's language (`useLanguage()`): the suite's GLOBAL language, which it
// resolves from the saved choice, then the device's language, then English —
// unless this app has its own, set in Tune this app ▸ Language. `language` is
// already that effective value, so the navbar, the profile menu and this app
// always agree. Until 2026-10-07 only the knowledge base was translated.
//
// Dictionaries live in `src/i18n/<lang>/<namespace>.ts`. English (en-GB) is
// the source of truth and defines the shape (`Messages`); every other language
// is typed against it (`Draft`), so `tsc` fails on a misspelt or stale key;
// a key a language has not translated yet shows in English. `i18n.test.ts`
// fails on a dropped placeholder or plural form, and `npm run i18n:check`
// also on a missing key — the gate before a release.
//
// Keys are `<namespace>.<key>`. Placeholders are `{name}`. A plural is two
// (or more) keys sharing a stem — `songs_one`, `songs_other` — read through
// `t.plural('common.songs', count)`, which picks the form with Intl.PluralRules
// and passes `{count}` for you. Terms: GLOSSARY.md, beside this file.
import { Fragment, useEffect, useMemo, type ReactNode } from 'react'
import { useLanguage, SUPPORTED_LANGUAGES } from '@unisim/sdk'
import {
  fill,
  getT,
  intlLocale,
  lookup,
  makeBasicTranslator,
  registerLanguages,
  setActiveLanguage,
  type BasicTranslator,
  type Draft,
  type MessageKey,
  type Messages,
  type PluralKey,
  type Vars,
} from './runtime.ts'
import { TRANSLATIONS } from './languages.ts'
import { en } from './en.ts'

export { getT, intlLocale }
export type { BasicTranslator, Draft, MessageKey, Messages, PluralKey, Vars }
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

registerLanguages(TRANSLATIONS)

// DEV ONLY: `?pseudo` in the address shows every translated string in ⟦brackets⟧,
// so any text on screen WITHOUT them is still hard-coded — the quickest check
// that a screen is translatable before any translation exists. `import.meta.env.DEV`
// is a build-time constant, so none of this reaches a production bundle.
const PSEUDO = 'en-x-pseudo' as Language
const pseudo =
  import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('pseudo')
if (pseudo) {
  registerLanguages({
    [PSEUDO]: Object.fromEntries(
      Object.entries(en).map(([ns, keys]) => [ns, Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, `⟦${v}⟧`]))]),
    ) as Messages,
  })
}
const shown = (language: Language): Language => (pseudo ? PSEUDO : language)

export interface Translator extends BasicTranslator {
  /**
   * A sentence with React nodes in it: `t.rich('app.tip_body', { button: <strong…/> })`.
   * Text around the nodes stays one string, so a translator can move the node
   * to wherever the sentence needs it.
   */
  rich(key: MessageKey, nodes: Record<string, ReactNode>, vars?: Vars): ReactNode
  lang: Language
}

export function makeTranslator(lang: Language): Translator {
  const t = makeBasicTranslator(lang) as Translator
  t.rich = (key, nodes, vars) => {
    const parts = fill(lookup(lang, key), vars).split(/(\{\w+\})/)
    return parts.map((part, i) => {
      const m = /^\{(\w+)\}$/.exec(part)
      return <Fragment key={i}>{m && m[1] in nodes ? nodes[m[1]] : part}</Fragment>
    })
  }
  return t
}

/** The translator for a component. Re-renders when the language changes. */
export function useT(): Translator {
  const { language } = useLanguage()
  return useMemo(() => makeTranslator(shown(language)), [language])
}

/**
 * Mount once, just inside <UniversalProvider>. Keeps `getT()` and `<html lang>`
 * on the suite language. Set during render, not in an effect, so the children
 * rendered in this same pass already see it.
 */
export function I18nRoot({ children }: { children: ReactNode }) {
  // `language` is the EFFECTIVE one: this app's override, else the global.
  const { language, setAppLanguage } = useLanguage()
  setActiveLanguage(shown(language))
  if (typeof document !== 'undefined' && document.documentElement.lang !== language) {
    document.documentElement.lang = language
  }
  // For store screenshots and layout checks: drive the app in English, switch
  // language just before each capture. Only what a user can already do from
  // Tune this app: it sets this app's override.
  useEffect(() => {
    ;(window as unknown as { __painterSetLanguage?: (l: Language) => void }).__painterSetLanguage = setAppLanguage
  }, [setAppLanguage])
  return <>{children}</>
}
