import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Google-sleutels voor synchroniseren (VITE_GOOGLE_*). Zonder eigen .env worden die van het
// vermogensoverzicht gebruikt: beide apps draaien op dezelfde site, dus dezelfde sleutels werken.
const root = dirname(fileURLToPath(import.meta.url));
const vermogen = resolve(root, '../vermogensoverzicht-broncode/vermogensoverzicht');
const ownEnv = ['.env', '.env.local', '.env.production'].some((f) => existsSync(resolve(root, f)));
const envDir = !ownEnv && existsSync(resolve(vermogen, '.env')) ? vermogen : root;

export default defineConfig({
  // De app draait in een submap van de Thuis-hub: https://<site>/onderhoud/
  base: '/onderhoud/',
  envDir,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Onderhoudslogboek',
        short_name: 'Onderhoud',
        description: 'Onderhoudslogboek voor auto, huis en apparaten',
        lang: 'nl',
        start_url: '/onderhoud/',
        scope: '/onderhoud/',
        id: '/onderhoud/',
        display: 'standalone',
        background_color: '#F3F5F9',
        theme_color: '#0C1830',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  build: { chunkSizeWarningLimit: 1200 },
  server: { port: 5174 },
  preview: { port: 4174 }
});
