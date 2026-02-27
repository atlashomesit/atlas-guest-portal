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
  },
});
