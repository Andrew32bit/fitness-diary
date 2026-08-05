import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

export default defineConfig({
  base: "/fitness-diary/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Дневник питания, веса и тренировок",
        short_name: "Дневник",
        description: "Личный дневник еды, веса и тренировок с историей Apple Health",
        lang: "ru",
        start_url: "/fitness-diary/",
        scope: "/fitness-diary/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "/fitness-diary/index.html",
      },
    }),
  ],
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{js,jsx}"],
    setupFiles: ["./tests/setup.js"],
  },
});
