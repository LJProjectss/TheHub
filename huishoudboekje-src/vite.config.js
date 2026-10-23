import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // De app draait in een submap van de Thuis-hub: https://<site>/huishoudboekje/
  base: "/huishoudboekje/",
  // Automatische tests (npm test): alleen de rekenlogica in src/lib, zonder browser.
  test: {
    include: ["src/**/*.test.js"],
    environment: "node",
  },
  plugins: [
    react(),
    VitePWA({
      // Registratie gebeurt in src/main.jsx (met periodieke update-check en automatisch herladen).
      registerType: "autoUpdate",
      injectRegister: false,
      // Nieuwe versie direct activeren en open vensters overnemen, ook als die nog een oudere
      // versie draaien (die sturen zelf geen "skip waiting"-bericht). Zonder dit wacht een update
      // tot álle vensters/tabbladen van de app dicht zijn - op de computer gebeurt dat vaak niet.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,woff2}"],
      },
      includeAssets: ["favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Huishoudboekje",
        short_name: "Huishoudboekje",
        start_url: "/huishoudboekje/",
        display: "standalone",
        background_color: "#F3F5F9",
        lang: "nl",
        scope: "/huishoudboekje/",
        id: "/huishoudboekje/",
        description: "Transacties, categorieën en budget bijhouden - lokaal in je browser.",
        theme_color: "#0C1830",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
