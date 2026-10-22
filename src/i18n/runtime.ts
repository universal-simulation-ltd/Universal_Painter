// The lookup itself, with no React and no SDK, so a lib module or a store can
// translate its messages and the vitest suite can import it without mounting
// anything. The same file as Universal QR's `src/i18n/runtime.ts`, plus the
// number and date helpers at the end.
//
// Only English is loaded here. `index.tsx` registers the other languages and
// sets the active one, so under vitest every message is English, which is what
// the tests read.
import { en, type Draft, type Messages } from './en.ts'

export type { Draft, Messages }

/** Every key, as `namespace.key`. */
export type MessageKey = {
  [N in keyof Messages]: `${N & string}.${keyof Messages[N] & string}`
}[keyof Messages]

/** The stem of every plural key: `common.songs` for `common.songs_one` + `common.songs_other`. */
export type PluralKey = MessageKey extends infer K
  ? K extends `${infer Stem}_other`
    ? Stem
    : never
  : never

export type Vars = Record<string, string | number>

const DICTS: Record<string, Draft> = { en }

export function registerLanguages(dicts: Record<string, Draft>): void {
  Object.assign(DICTS, dicts)
}

/**
 * The dictionaries to try, in order — the SDK's `languageFallbacks`, restated so
 * this file needs nothing from the SDK: `pt-BR` → pt-BR, pt-PT; any other `pt`
 * → pt-PT, pt-BR; `fr-CA` → fr; always ending in English. `en-gb` (the suite's
 * default) and `en` both land on English.
 */
function chain(lang: string): Draft[] {
  const l = lang.replace('_', '-').toLowerCase()
  const codes =
    l === 'pt-br' ? ['pt-BR', 'pt-PT']
      : l.startsWith('pt') ? ['pt-PT', 'pt-BR']
        : [l, l.split('-')[0]]
  return [...codes.map((c) => DICTS[c]).filter(Boolean), en]
}

function find(lang: string, key: string): string | undefined {
  const dot = key.indexOf('.')
  const ns = key.slice(0, dot) as keyof Messages
  const k = key.slice(dot + 1)
  for (const dict of chain(lang)) {
    const hit = (dict[ns] as Record<string, string> | undefined)?.[k]
    if (hit !== undefined) return hit
  }
  return undefined
}

export function fill(s: string, vars?: Vars): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

/**
 * Intl wants a BCP 47 tag. The SDK's plain `en` means US English and its
 * `en-gb` British; every other code is already a tag Intl knows.
 */
export function intlLocale(lang: string): string {
  return lang === 'en' ? 'en-US' : lang === 'en-gb' ? 'en-GB' : lang
}

export interface BasicTranslator {
  (key: MessageKey, vars?: Vars): string
  /**
   * A plural: `t.plural('common.songs', 3)` → "3 songs". `{count}` is filled
   * in, formatted for the language ("1,204" / "1.204" / "1 204").
   */
  plural(stem: PluralKey, count: number, vars?: Vars): string
  /** A number formatted for the active language. */
  num(n: number): string
  /** The active language code, for Intl formatting: `intlLocale(t.lang)`. */
  lang: string
  /** `intlLocale(lang)`, ready for `new Intl.DateTimeFormat(t.locale, …)`. */
  locale: string
}

export function lookup(lang: string, key: string): string {
  return find(lang, key) ?? key
}

export function makeBasicTranslator(lang: string): BasicTranslator {
  const locale = intlLocale(lang)
  const numbers = new Intl.NumberFormat(locale)
  const plurals = new Intl.PluralRules(locale)
  const t = ((key: MessageKey, vars?: Vars) => fill(lookup(lang, key), vars)) as BasicTranslator
  t.plural = (stem, count, vars) => {
    const form = plurals.select(count)
    const text = find(lang, `${stem}_${form}`) ?? lookup(lang, `${stem}_other`)
    return fill(text, { count: numbers.format(count), ...vars })
  }
  t.num = (n) => numbers.format(n)
  t.lang = lang
  t.locale = locale
  return t
}

let active: BasicTranslator = makeBasicTranslator('en-gb')

/**
 * The translator for code that is not a component (stores, lib, callbacks).
 *
 * ⚠️ Call it at the moment the text is needed, never at module level: a
 * constant built at import time is frozen in whatever language was active
 * then (always English), and never follows a change in Tune this app.
 */
export function getT(): BasicTranslator {
  return active
}

export function setActiveLanguage(lang: string): void {
  if (active.lang !== lang) active = makeBasicTranslator(lang)
}
