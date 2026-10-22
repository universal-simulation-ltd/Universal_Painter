import React from 'react'
import ReactDOM from 'react-dom/client'
import { UniversalProvider, type ProductCode } from '@unisim/sdk'
import App from './App'
import { I18nRoot } from './i18n'
import './index.css'

// Universal Painter never sends a picture anywhere. <UniversalProvider> is
// mounted for the shared navbar, the suite language and Tune this app.
//
// No sign-in, in every build (James, 2026-10-20: no logins in first iterations
// unless they improve the experience; Docs_UNI_SIM/login-free-plan.md). Nothing
// here needs an account. `noAccounts` drops every account row, keeps the app
// signed out of any suite session the browser holds, and switches the SDK's
// anonymous daily open count off. No <UsageTracker /> either.
//
// ⚠️ `product: 'painter'` and the cast. The suite switcher already lists
// Painter (@unisim/sdk ≥ 0.201.0), but 'painter' is not yet in the SDK's
// `ProductCode` union, its `UNIVERSAL_APP_PRODUCTS` list or the platform's
// `product_code` enum — those three are registered separately. The cast is
// safe ONLY because this app sends nothing that names its product: there is
// no session (noAccounts), no usage row and no open count. Remove it the
// moment `ProductCode` has 'painter', and never copy it into an app that
// records usage. `cookieDomain` is left unset for the same reason: an app
// missing from UNIVERSAL_APP_PRODUCTS would otherwise share the Assess suite's
// language cookie; without a cookie domain the language stays in this
// browser's own storage, which is what a listed Universal App gets anyway.
const universalConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://rygfxgalojojppxmhddo.supabase.co',
  supabaseAnonKey:
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Z2Z4Z2Fsb2pvanBweG1oZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTY4MjUsImV4cCI6MjA5NDMzMjgyNX0.hLy_vt9vY_rdPKF3nL32yAuMCD604E3CH5VM7D7CaNE',
  product: 'painter' as unknown as ProductCode,
  noAccounts: true,
  openCount: false,
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UniversalProvider config={universalConfig}>
      <I18nRoot>
        <App />
      </I18nRoot>
    </UniversalProvider>
  </React.StrictMode>,
)
