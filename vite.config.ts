import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Percorsi relativi: la stessa build funziona in locale (/) e su GitHub Pages (/EasyChess/).
  base: './',
  plugins: [
    react(),
    VitePWA({
      // Una nuova build si installa da sola: i progressi sono in localStorage e non vengono toccati.
      registerType: 'autoUpdate',
      base: './',
      scope: './',
      includeManifestIcons: false,
      manifest: {
        id: './',
        name: 'EasyChess',
        short_name: 'EasyChess',
        description: 'Impara le aperture di scacchi: corso guidato, allenamento, ripasso e Stockfish.',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#1d1b18',
        theme_color: '#272420',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Anche Stockfish (engine/stockfish.wasm, ~7 MB) va in cache: il Laboratorio funziona offline.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,wasm}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5317 },
  preview: { port: 5317, strictPort: true },
  test: { environment: 'node' },
});
