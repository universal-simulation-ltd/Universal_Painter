import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Universal Painter is served at opensource.unisim.co.uk/painter/ behind the
// portal Worker, so production assets live under /painter/. Local dev stays /.
//
// There is no native (Capacitor) build yet, so there is no `desktop` mode; when
// one is added it needs a RELATIVE base and no service worker, as in every
// other suite app (see Universal_Jukebox/vite.config.ts).
export default defineConfig(({ mode }) => {
  const BASE_PATH = mode === 'production' ? '/painter/' : '/'
  return {
    base: BASE_PATH,
    // 5212 is this app's slot in the registry (Docs_UNI_SIM/dev-preview.md).
    server: { port: 5212, strictPort: true },
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    // One React for the app and @unisim/sdk, or hooks fail with "Invalid hook call".
    resolve: { dedupe: ['react', 'react-dom'] },
    optimizeDeps: { exclude: ['@unisim/sdk'], include: ['qr-code-styling'] },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'unisim-icon.png', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'Universal Painter',
          short_name: 'Painter',
          description: 'Draw, and touch up pictures, in your browser. Nothing is uploaded.',
          theme_color: '#0f172a',
          background_color: '#f1f5f9',
          display: 'standalone',
          start_url: BASE_PATH,
          scope: BASE_PATH,
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: `${BASE_PATH}index.html`,
          // ⚠️ The HEIC decoder (~3 MB) stays OUT of the install-time precache,
          // so only people who open an iPhone photo download it (Images,
          // Compress and Converter make the same bargain). Cached after first use.
          globIgnores: ['**/*.wasm', '**/heic-to-*.js'],
          runtimeCaching: [
            {
              urlPattern: /\/assets\/heic-to-.*\.js$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'heic-to',
                expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
  }
})
