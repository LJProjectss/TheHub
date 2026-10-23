import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// De hub draait in de root (/) van de site. De drie apps staan in submappen.
// De service worker van de hub mag alleen de hub zelf afhandelen, anders zou hij
// navigaties naar /huishoudboekje/ enz. kapen en de hub tonen in plaats van de app.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Thuis',
        short_name: 'Thuis',
        description: 'Startpunt voor huishoudboekje, vermogensoverzicht en onderhoudslogboek, met één back-up.',
        lang: 'nl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F3F5F9',
        theme_color: '#0C1830',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Alleen de hub-pagina zelf; alle andere paden (de apps) gaan gewoon naar het netwerk.
        navigateFallbackAllowlist: [/^\/$/, /^\/index\.html$/]
      }
    })
  ]
});
