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
    // Windows: release gate runs API/admin/guest Vitest in parallel — avoid thread-pool startup timeouts (Vitest 4: maxWorkers).
    ...(process.platform === "win32"
      ? { maxWorkers: 1 }
      : process.env.CI
        ? { maxWorkers: 2 }
        : {}),
    isolate: true,
    hookTimeout: 60000,
    // Heavy route smokes: full App / lazy imports exhaust Vitest worker heap on Windows
    // and can stall the suite; run explicitly (`npx vitest run <file>`) or cover via Playwright.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/*-preview-*/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
      "tests/propertyDetailsRouteSmoke.test.tsx",
      "tests/PropertyDetailsMedia.test.tsx",
      "src/App.a11y.test.tsx",
    ],
  },
});
