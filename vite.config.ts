import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const RUNTIME_CONFIG_PATH = path.resolve(__dirname, "public/.well-known/atlas-runtime-config.json");
const MANIFEST_PATH = path.resolve(__dirname, "public/manifest.webmanifest");
const BACKEND_TARGET = "http://localhost:5120";

/** In dev, serve runtime config with apiBaseUrl = 5120 (API only). */
function devRuntimeConfigPlugin() {
  return {
    name: "dev-runtime-config",
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/.well-known/atlas-runtime-config.json")) {
          return next();
        }
        let config: Record<string, unknown>;
        try {
          const raw = fs.readFileSync(RUNTIME_CONFIG_PATH, "utf-8");
          config = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return next();
        }
        config = { ...config, apiBaseUrl: BACKEND_TARGET };
        const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
        if (mapsKey) config.googleMapsApiKey = mapsKey;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(config));
      });
    },
  };
}

/**
 * Serve `/manifest.json` as an alias for `/manifest.webmanifest` with an
 * explicit `application/json` Content-Type. PWA tooling and several E2E
 * checks expect this canonical path; without the alias, Vite falls back to
 * the SPA's `index.html` and the response masquerades as `text/html`.
 */
function devManifestJsonAliasPlugin() {
  return {
    name: "dev-manifest-json-alias",
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/manifest.json") {
          return next();
        }
        try {
          const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
          // Round-trip parse so we ship strict JSON (no comments / trailing commas).
          const parsed = JSON.parse(raw);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.end(JSON.stringify(parsed));
        } catch {
          // Fall through to the default 404/SPA handler if the manifest is missing.
          return next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devRuntimeConfigPlugin(),
    devManifestJsonAliasPlugin(),
  ],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
  },
  server: {
    port: 5174,
    /** Must stay 5174 — E2E and docs assume guest portal here; do not silently move to another port. */
    strictPort: true,
    headers: {
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    },
    proxy: {
      "/listings": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/availability": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/bookings": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/api": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/properties": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/pricing": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Core React libraries
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react-router-dom")) {
            return "react-core";
          }
          if (id.includes("node_modules/react/")) {
            return "react";
          }

          // UI libraries
          if (id.includes("node_modules/@emotion")) {
            return "emotion";
          }
          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/react-icons")) {
            return "icons";
          }
          if (id.includes("node_modules/react-toastify")) {
            return "toast";
          }

          // Maps (heavy, only on LocationPage)
          if (id.includes("node_modules/leaflet") || id.includes("node_modules/react-leaflet")) {
            return "maps";
          }

          // Carousel (heavy, only on home/search pages)
          if (id.includes("node_modules/swiper") || id.includes("node_modules/react-slick") || id.includes("node_modules/slick-carousel")) {
            return "carousel";
          }

          // Date/time libraries
          if (id.includes("node_modules/date-fns") || id.includes("node_modules/luxon") || id.includes("node_modules/react-calendar") || id.includes("node_modules/react-date-range")) {
            return "datetime";
          }

          // Payment (heavy, only on checkout)
          if (id.includes("node_modules/axios") || id.includes("node_modules/qrcode.react")) {
            return "payment";
          }

          // Markdown rendering (only on content pages)
          if (id.includes("node_modules/react-markdown")) {
            return "markdown";
          }

          // Framer Motion (animation)
          if (id.includes("node_modules/framer-motion")) {
            return "motion";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
