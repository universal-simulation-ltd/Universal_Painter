// Every language has every key, and nothing else; every translation keeps the
// English placeholders ({name}) and plural stems. `tsc` already fails on a
// misspelt or stale key (each dictionary is typed against English) — this also
// catches a dropped `{count}`, an extra key, and an empty string, and keeps
// catching them if anyone loosens a type.
//
// ⚠️ A MISSING key fails only under `npm run i18n:check` (I18N_STRICT set).
// Translations land a language at a time, and a key not translated yet shows
// in English, so the everyday `npm test` stays green while they are in
// progress; the strict run is the gate before a release. One language:
// `I18N_STRICT=de npm test` (or several: `I18N_STRICT=de,fr`). The everyday run still
// prints how far each language has got (`--reporter=verbose`).
import { describe, expect, it } from 'vitest'
import { en } from './en.ts'
import { TRANSLATIONS } from './languages.ts'
import { getT, makeBasicTranslator, registerLanguages } from './runtime.ts'

const SUITE = ['fr', 'es', 'it', 'de', 'pt-BR', 'pt-PT', 'tr']

/** `I18N_STRICT=1` (or `all`) requires every language; `I18N_STRICT=de,fr` just those. */
const STRICT = (process.env.I18N_STRICT ?? '').split(/[\s,]+/).filter(Boolean)
const strict = (lang: string) => STRICT.includes('1') || STRICT.includes('all') || STRICT.includes(lang)

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

function flat(dict: Record<string, Partial<Record<string, string>>>): Map<string, string> {
  const out = new Map<string, string>()
  for (const [ns, keys] of Object.entries(dict)) {
    for (const [k, v] of Object.entries(keys)) if (v !== undefined) out.set(`${ns}.${k}`, v)
  }
  return out
}

const english = flat(en)

describe('i18n dictionaries', () => {
  it('registers every suite language', () => {
    expect(Object.keys(TRANSLATIONS).sort()).toEqual([...SUITE].sort())
  })

  it('English has no empty strings', () => {
    for (const [key, value] of english) expect(value.trim(), key).not.toBe('')
  })

  for (const lang of SUITE) {
    describe(lang, () => {
      const dict = TRANSLATIONS[lang] ? flat(TRANSLATIONS[lang]) : new Map<string, string>()

      const missing = [...english.keys()].filter((k) => !dict.has(k))

      it(`has ${english.size - missing.length} of ${english.size} English keys`, () => {
        if (strict(lang)) expect(missing).toEqual([])
      })

      it('has no key English lacks', () => {
        // A plural form English does not use (`_few`, `_many`) is allowed when
        // its stem exists in English.
        const extra = [...dict.keys()].filter(
          (k) => !english.has(k) && !(/_(zero|two|few|many)$/.test(k) && english.has(k.replace(/_(zero|two|few|many)$/, '_other'))),
        )
        expect(extra).toEqual([])
      })

      it('keeps every placeholder and leaves nothing empty', () => {
        const wrong: string[] = []
        for (const [key, value] of dict) {
          if (value.trim() === '') wrong.push(`${key}: empty`)
          const source = english.get(key) ?? english.get(key.replace(/_(zero|two|few|many)$/, '_other'))
          if (source === undefined) continue
          // Exactly the same set — even `{count}` in a `_one` form, because
          // French and Portuguese pick "one" for 0 as well as 1.
          const want = placeholders(source)
          const got = placeholders(value)
          if (JSON.stringify(want) !== JSON.stringify(got)) wrong.push(`${key}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`)
        }
        expect(wrong).toEqual([])
      })
    })
  }
})

describe('runtime', () => {
  it('reads English under node, so the other tests see English', () => {
    expect(getT()('common.cancel')).toBe('Cancel')
    expect(getT().plural('common.steps', 1)).toBe('1 step')
    expect(getT().plural('common.steps', 1204)).toBe('1,204 steps')
  })

  it('falls back to English for an unknown language', () => {
    expect(makeBasicTranslator('xx').plural('common.steps', 2)).toBe('2 steps')
  })

  it('falls back to English key by key in a part-translated language', () => {
    registerLanguages({ 'it-x-part': { ...Object.fromEntries(Object.keys(en).map((ns) => [ns, {}])), common: { cancel: 'Annuler', steps_one: '{count} passo' } } as never })
    const t = makeBasicTranslator('it-x-part')
    expect(t('common.cancel')).toBe('Annuler')
    expect(t('common.close')).toBe('Close')
    expect(t.plural('common.steps', 1)).toBe('1 passo')
    // `_other` is not translated yet: English's, rather than the key.
    expect(t.plural('common.steps', 2)).toBe('2 steps')
  })

  it('picks plural forms by the language: French and Portuguese say "one" for 0', () => {
    registerLanguages({ 'fr-x-test': { common: { steps_one: '{count} étape', steps_other: '{count} étapes' } } as never })
    expect(makeBasicTranslator('fr-x-test').plural('common.steps', 0)).toBe('0 étape')
    expect(makeBasicTranslator('fr-x-test').plural('common.steps', 1204)).toBe('1\u202f204 étapes')
  })
})
