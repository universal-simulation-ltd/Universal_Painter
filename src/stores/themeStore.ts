import { createThemeStore, type ThemePref } from '@unisim/sdk'

// The light/dark/system preference, from the SDK's createThemeStore. It opens
// LIGHT and stays light until the person chooses otherwise (the suite rule),
// even on a device set to dark: only an explicit Dark or Match my device in
// Tune this app changes it. Absent, the app follows the suite-wide choice
// (`universal:color-scheme`).
//
// ⚠️ The key is every user's saved choice. It is written a second time in the
// pre-paint script in `index.html`; `src/lib/theme.test.ts` fails if the two
// ever drift.
export type { ThemePref }

export const useThemeStore = createThemeStore('unisim-painter-theme')
