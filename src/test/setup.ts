import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { setRuntimeConfig } from "../runtime-config";
import { _resetTenantResolutionForTests } from "../tenant/tenantResolver";
import { _resetTenantContextForTests } from "../tenant/tenantContext";
import { _resetAvailabilityCalendarCacheForTests } from "../api/availabilityCalendarClient";
import { _resetDedupedJsonFetchForTests } from "../api/dedupedJsonFetch";
import { _resetCurrentLayoutThemeIdForTests } from "../themes/registry";

// Re-arm the real jsdom `window` if a previous test file in this worker replaced
// the global and leaked it (e.g. `Object.defineProperty(global, "window", ...)`
// without an afterEach restore — see OptimizedImage.test.ts regression, gate runs
// 2026-07-10). Under shared-fast (isolate:false, single worker) a leaked
// plain-object window crashes the NEXT React commit in react-dom's
// getActiveElementDeep (`element instanceof win.HTMLIFrameElement` → TypeError:
// RHS is not an object), which corrupts React's workInProgress state and makes
// every later test's afterEach(cleanup) throw "Should not already be working" —
// a whole-worker cascade whose membership varies with file ordering. This setup
// file re-executes per test file, so restoring here confines any such leak to
// the offending file. The real window is stashed on globalThis (not in module
// scope) because this module's scope is re-created on each re-execution.
const REAL_WINDOW_KEY = "__atlasRealJsdomWindow__";
const globals = globalThis as unknown as Record<string, unknown>;
if (globals[REAL_WINDOW_KEY] === undefined) {
  globals[REAL_WINDOW_KEY] = globalThis.window;
}
if (globalThis.window !== globals[REAL_WINDOW_KEY]) {
  Object.defineProperty(globalThis, "window", {
    value: globals[REAL_WINDOW_KEY],
    writable: true,
    configurable: true,
  });
}

// Module-level state that boot code (main.tsx / resolveFromDomain) mutates must be
// re-armed per test file: under the shared-fast project (isolate:false, see
// vitest.config.ts) modules outlive test files, so state set by one file (e.g.
// internalTenantRobots.test.ts resolving tenant "atlas-showcase") leaks into the
// next. This setup file re-executes per test file, restoring the fresh-module
// semantics that isolation used to provide.
_resetTenantResolutionForTests();
_resetTenantContextForTests();
_resetAvailabilityCalendarCacheForTests();
_resetDedupedJsonFetchForTests();
_resetCurrentLayoutThemeIdForTests();

// The shared-fast project runs with `isolate: false` (see vitest.config.ts). With a
// shared module graph, @testing-library/react's built-in auto-cleanup registers its
// `afterEach(cleanup)` only ONCE — at first import — so it attaches to whichever test
// file imported it first and every later file leaks its DOM into the shared jsdom
// `document`. Registering cleanup here, from a setup file (re-executed per test file),
// guarantees it runs after every test in every file.
afterEach(() => {
  cleanup();
});

// Default runtime config for tests that don't mock it (avoids "Runtime config not loaded")
setRuntimeConfig({
  apiBaseUrl: "https://api.test",
  globalDiscountPercent: 0,
});

// Prevent real network requests from hanging tests (e.g. SearchAvailabilityWidget's hero
// availability fetch). Tests that need fetch should mock it per-test with vi.mocked(global.fetch).
Object.defineProperty(global, "fetch", {
  writable: true,
  value: vi.fn().mockRejectedValue(new Error("Network requests are disabled in tests. Mock global.fetch in your test.")),
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
