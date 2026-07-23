import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// The PWA plugin is build/dev only. Under Vitest we skip it and alias the
// virtual module to a stub (see tests/stubs/pwaRegister.ts) so tests never
// try to resolve or run the service-worker machinery.
const isVitest = process.env.VITEST !== undefined

// GitHub Pages serves this project site under the /tock/ subpath. The Pages
// build sets GITHUB_PAGES=true so assets, the SW scope, and navigateFallback
// resolve under that prefix. Every other target (local preview, other static
// hosts) keeps the path-agnostic relative base.
const ghPages = process.env.GITHUB_PAGES === 'true'
const base = ghPages ? '/tock/' : './'

export default defineConfig({
  base,
  plugins: [
    react(),
    ...(isVitest
      ? []
      : [
          VitePWA({
            registerType: 'prompt',
            // Registration is done by the useRegisterSW React hook, so do not
            // also inject a standalone registerSW.js (would double-register).
            injectRegister: false,
            pwaAssets: { config: true },
            manifest: {
              name: 'Tock',
              short_name: 'Tock',
              description: 'Tock — course de billes. Un jeu de plateau à cartes, en solo contre des bots ou à plusieurs sur le même téléphone.',
              lang: 'fr',
              display: 'standalone',
              orientation: 'portrait',
              start_url: '.',
              theme_color: '#0c211d',
              background_color: '#0c211d',
              categories: ['games']
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
              navigateFallback: ghPages ? '/tock/index.html' : 'index.html'
            }
          })
        ])
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    alias: {
      'virtual:pwa-register/react': fileURLToPath(new URL('./tests/stubs/pwaRegister.ts', import.meta.url))
    }
  }
})
