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
    testTimeout: 120000, // 2 minutes for heavy property tests
    // Optimize memory usage in CI environments — disable worker pool entirely
    pool: process.env.CI ? "none" : "threads",
    poolOptions: process.env.CI ? {} : {
      threads: {
        singleThread: false,
      },
    },
    isolate: true,
    hookTimeout: 60000,
    // TODO(atlas-guest-portal): refactor propertyDetailsRouteSmoke.test.tsx —
    // it loads the full route stack and exhausts CI runner heap (>8GB) even in
    // sequential mode. Skipped in CI until split into smaller mocked tests.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
      ...(process.env.CI ? ["tests/propertyDetailsRouteSmoke.test.tsx"] : []),
    ],
  },
});
