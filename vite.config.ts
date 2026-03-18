import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const RUNTIME_CONFIG_PATH = path.resolve(__dirname, "public/.well-known/atlas-runtime-config.json");
const BACKEND_TARGET = "http://localhost:5120";

<<<<<<< HEAD
/** In dev, serve runtime config with apiBaseUrl = dev server origin so API calls go through Vite proxy (avoids CORS). */
function devRuntimeConfigPlugin() {
  return {
    name: "dev-runtime-config",
    configureServer(server: { config: { server?: { port?: number } }; middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
=======
/** In dev, serve runtime config with apiBaseUrl = 5120 (API only). */
function devRuntimeConfigPlugin() {
  return {
    name: "dev-runtime-config",
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/.well-known/atlas-runtime-config.json")) {
          return next();
        }
<<<<<<< HEAD
        const port = server.config.server?.port ?? 5174;
        const devOrigin = `http://localhost:${port}`;
=======
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
        let config: Record<string, unknown>;
        try {
          const raw = fs.readFileSync(RUNTIME_CONFIG_PATH, "utf-8");
          config = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return next();
        }
<<<<<<< HEAD
        config = { ...config, apiBaseUrl: devOrigin };
=======
        config = { ...config, apiBaseUrl: BACKEND_TARGET };
        const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
        if (mapsKey) config.googleMapsApiKey = mapsKey;
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(config));
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devRuntimeConfigPlugin(),
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
    proxy: {
      "/listings": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/availability": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/bookings": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/api": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/properties": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
      "/pricing": { target: BACKEND_TARGET, changeOrigin: true, secure: false },
    },
  },
<<<<<<< HEAD
=======
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          razorpay: ["axios"],
          ui: ["lucide-react", "react-toastify", "date-fns"],
        },
      },
    },
  },
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
