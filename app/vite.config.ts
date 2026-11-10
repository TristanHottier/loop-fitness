import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest: we write the service worker (src/sw.ts) so it can handle
      // Web Push reminders. VitePWA injects the precache manifest into it.
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // The manifest lives in public/manifest.webmanifest and is copied to dist as-is.
      manifest: false,
      injectRegister: 'auto',
      // In injectManifest mode the workbox build options live under `injectManifest`,
      // not `workbox`. globPatterns controls what gets precached for offline.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest,json}'],
      },
    }),
  ],
})
