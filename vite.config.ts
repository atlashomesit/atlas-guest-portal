import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import { clampTransformWidth, isAllowedBlobImageUrl } from "./functions/_lib/guestImageProxy";

const RUNTIME_CONFIG_PATH = path.resolve(__dirname, "public/.well-known/atlas-runtime-config.json");
const MANIFEST_PATH = path.resolve(__dirname, "public/manifest.webmanifest");
// Dev-server backend target for the vite proxy + dev runtime-config plugin.
// Resolved, in order: (1) VITE_API_PROXY_TARGET env (explicit override), then
// (2) the apiBaseUrl already written into atlas-runtime-config.json — non-default
// dev stacks set this (e.g. the WSL release-gate sandbox rewrites it to :5320),
// then (3) the :5120 default for normal local dev. This keeps Windows/local dev
// unchanged (committed config = :5120) while letting an alternate stack redirect
// the proxy without editing this file. Dev-only: neither the proxy nor
// devRuntimeConfigPlugin runs in a production build.
function resolveBackendTarget(): string {
  const override = (process.env.VITE_API_PROXY_TARGET || "").trim();
  if (override) return override;
  try {
    const cfg = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, "utf-8")) as { apiBaseUrl?: string };
    if (cfg.apiBaseUrl && cfg.apiBaseUrl.trim()) return cfg.apiBaseUrl.trim();
  } catch {
    /* file missing/unreadable → fall through to default */
  }
  return "http://localhost:5120";
}
const BACKEND_TARGET = resolveBackendTarget();

/** In dev, serve runtime config with apiBaseUrl = BACKEND_TARGET (API only). */
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
 * TASK-7821: Vite dev `/img?u=&w=` actually resizes with sharp (same allowlist as
 * `functions/img.ts`). A 302 to the blob would still ship the multi-MB original.
 */
function devGuestImageProxyPlugin() {
  return {
    name: "dev-guest-image-proxy",
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url?.split("?")[0];
        if (rawUrl !== "/img") {
          return next();
        }
        void (async () => {
          try {
            const parsed = new URL(req.url ?? "", "http://local.invalid");
            const origin = (parsed.searchParams.get("u") ?? "").trim();
            if (!isAllowedBlobImageUrl(origin)) {
              res.statusCode = 400;
              res.end("Invalid image origin");
              return;
            }
            const width = clampTransformWidth(parsed.searchParams.get("w"));
            const upstream = await fetch(origin, { redirect: "manual" });
            if (upstream.status >= 300 && upstream.status < 400) {
              res.statusCode = 400;
              res.end("Redirected image origin is not allowed");
              return;
            }
            if (!upstream.ok) {
              res.statusCode = upstream.status === 404 ? 404 : 502;
              res.end("Image origin failed");
              return;
            }
            const bytes = Buffer.from(await upstream.arrayBuffer());
            const sharp = (await import("sharp")).default;
            const body = await sharp(bytes)
              .resize({ width, withoutEnlargement: true })
              .webp({ quality: 75 })
              .toBuffer();
            res.statusCode = 200;
            res.setHeader("Content-Type", "image/webp");
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            res.setHeader("X-Atlas-Image-Proxy", "1");
            res.setHeader("X-Atlas-Image-Width", String(width));
            res.end(body);
          } catch {
            res.statusCode = 502;
            res.end("Image origin unreachable");
          }
        })();
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
    tailwindcss(),
    react(),
    devRuntimeConfigPlugin(),
    devGuestImageProxyPlugin(),
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
      "/tenants": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/listings": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/availability": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/bookings": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/api": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/properties": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/pricing": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
    },
  },
  build: {
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          // Heavy, route-level only — keep off the homepage graph.
          if (id.includes("node_modules/leaflet") || id.includes("node_modules/react-leaflet")) {
            return "maps";
          }
          if (id.includes("node_modules/react-markdown")) {
            return "markdown";
          }
          if (id.includes("node_modules/axios") || id.includes("node_modules/qrcode.react")) {
            return "payment";
          }
          // TASK-7839: one vendor chunk instead of 10 tiny splits that became 49 requests.
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
