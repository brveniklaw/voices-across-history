import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served at https://voicesacrosshistory.intexiau.com/explorers/ (the platform hub proxies this path to this project).
const BASE = '/explorers/'

export default defineConfig({
  base: BASE,
  build: { outDir: 'dist/explorers', emptyOutDir: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: "Voices of the Explorers",
        short_name: "Explorers",
        description: "Travel with history's great explorers, grounded in their own journals and accounts.",
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#0F1418',
        theme_color: '#4F8A8B',
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
  server: { proxy: { '/explorers/api': { target: 'http://localhost:3000', rewrite: (p) => p.replace(BASE, '/') } } }
})
