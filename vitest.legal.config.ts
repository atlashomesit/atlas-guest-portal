import { defineConfig } from "vitest/config";
import path from "path";

// Minimal config for legal content validation tests (no jest-dom/DOM setup)
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/content/legal/validateLegalContent.test.ts"],
    // Use threads pool instead of forks (default) to avoid subprocess
    // fork-timeout failures when running under heavy parallel build load
    // (release gate runs API, admin, and guest builds simultaneously).
    pool: "threads",
  },
});
