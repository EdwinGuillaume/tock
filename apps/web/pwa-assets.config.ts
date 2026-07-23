import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the icon set (pwa-192, pwa-512, maskable, apple-touch-icon,
// favicon) from the single frozen source. The '2023' head preset makes
// vite-plugin-pwa inject the matching <link> tags automatically.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/icon.svg']
})
