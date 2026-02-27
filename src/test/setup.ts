import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { setRuntimeConfig } from "../runtime-config";

// Default runtime config for tests that don't mock it (avoids "Runtime config not loaded")
setRuntimeConfig({
  apiBaseUrl: "https://api.test",
  globalDiscountPercent: 0,
});

// Avoid "window.matchMedia is not a function" in components that use media queries
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
