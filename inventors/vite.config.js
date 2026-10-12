import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served at https://voicesacrosshistory.intexiau.com/inventors/ (the platform hub proxies this path to this project).
const BASE = '/inventors/'

export default defineConfig({
  base: BASE,
  build: { outDir: 'dist/inventors', emptyOutDir: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: "Voices of the Inventors",
        short_name: "Inventors",
        description: "Converse with history's great inventors \u2014 grounded in their own notebooks and papers.",
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#0A0E14',
        theme_color: '#B87333',
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
  server: { proxy: { '/inventors/api': { target: 'http://localhost:3000', rewrite: (p) => p.replace(BASE, '/') } } }
})
