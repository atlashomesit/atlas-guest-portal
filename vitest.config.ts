import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime.js"),
      "react-router-dom/node_modules/react": path.resolve(__dirname, "node_modules/react"),
      "react-router-dom/node_modules/react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    deps: {
      inline: ["react-router", "react-router-dom"],
    },
    globals: true,
    testTimeout: 30000,
    // Reduce memory usage in CI environments
    threads: process.env.CI ? 2 : 4,
    maxThreads: process.env.CI ? 2 : 4,
    minThreads: 1,
    isolate: true,
    hookTimeout: 30000,
  },
});
