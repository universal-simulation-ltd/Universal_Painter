import React from 'react'
import ReactDOM from 'react-dom/client'
import { UniversalProvider } from '@unisim/sdk'
import App from './App'
import { I18nRoot } from './i18n'
import './index.css'

// Universal Painter never sends a picture anywhere. <UniversalProvider> is
// mounted for the shared navbar, the suite language and Tune this app.
//
// No accounts of its own, in every build (James, 2026-10-20: no logins in first
// iterations unless they improve the experience;
// Docs_UNI_SIM/login-free-plan.md). Nothing here needs an account. `noAccounts`
// drops every account row and switches the SDK's anonymous daily open count
// off. Since SDK 0.211.0 it no longer keeps the app signed out: a suite session
// the browser already holds is read and followed (Global Tuning comes with it),
// and Tune this app offers a discreet Sign in. No <UsageTracker /> either.
//
// `product: 'painter'` type-checks because the SDK's `ProductCode` really holds
// it (@unisim/sdk 0.204.0, with the `product_code` enum value from platform
// migration 0312). Never cast it: if the type objects, the enum is missing.
const universalConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://rygfxgalojojppxmhddo.supabase.co',
  supabaseAnonKey:
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5Z2Z4Z2Fsb2pvanBweG1oZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTY4MjUsImV4cCI6MjA5NDMzMjgyNX0.hLy_vt9vY_rdPKF3nL32yAuMCD604E3CH5VM7D7CaNE',
  product: 'painter' as const,
  cookieDomain: import.meta.env.PROD ? '.unisim.co.uk' : undefined,
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
