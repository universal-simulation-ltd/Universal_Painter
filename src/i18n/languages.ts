// Every translation, registered by `index.tsx` and read by `i18n.test.ts`.
// Kept apart from `index.tsx` so the test can import the dictionaries without
// the SDK or React. English is not here: it is the source, loaded by runtime.ts.
//
// Each language is a folder with the same files as `en/`, typed as a `Draft`
// (any subset of the English keys); a key it lacks shows in English.
import type { Draft } from './runtime.ts'
import { fr } from './fr.ts'
import { es } from './es.ts'
import { it } from './it.ts'
import { de } from './de.ts'
import { ptBR } from './pt-BR.ts'
import { ptPT } from './pt-PT.ts'
import { tr } from './tr.ts'

export const TRANSLATIONS: Record<string, Draft> = { fr, es, it, de, 'pt-BR': ptBR, 'pt-PT': ptPT, tr }
