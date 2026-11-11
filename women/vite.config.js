import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served at https://voicesacrosshistory.intexiau.com/women/ (the platform hub proxies this path to this project).
const BASE = '/women/'

export default defineConfig({
  base: BASE,
  build: { outDir: 'dist/women', emptyOutDir: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: "Voices of Great Women",
        short_name: "Great Women",
        description: "Talk with the great women of history, grounded in their own writings and speeches.",
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#16111A',
        theme_color: '#9A5B7A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/\/api\//],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } } }
        ]
      }
    })
  ],
  server: { proxy: { '/women/api': { target: 'http://localhost:3000', rewrite: (p) => p.replace(BASE, '/') } } }
})
