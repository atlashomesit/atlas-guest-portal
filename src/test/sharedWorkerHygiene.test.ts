import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSharedWorkerState, restoreDocumentVisibility } from "./sharedWorkerHygiene";

// TASK-102734: a file that pins document.visibilityState must not hand a hidden tab to the next file its shared
// (isolate:false) worker runs. See the note in ./sharedWorkerHygiene.ts.
afterEach(() => {
  restoreDocumentVisibility();
});

describe("restoreDocumentVisibility", () => {
  it("starts from a visible tab", () => {
    expect(document.visibilityState).toBe("visible");
  });

  it("undoes a value override (the abandonOnDeparture shape)", () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    expect(document.visibilityState).toBe("hidden");
    restoreDocumentVisibility();
    expect(document.visibilityState).toBe("visible");
  });

  it("undoes a getter override (the GuestMessageThread.visibility shape)", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    expect(document.visibilityState).toBe("hidden");
    restoreDocumentVisibility();
    expect(document.visibilityState).toBe("visible");
  });

  it("is a no-op when nothing was overridden", () => {
    expect(() => restoreDocumentVisibility()).not.toThrow();
    expect(document.visibilityState).toBe("visible");
  });
});

// TASK-102734: the rest of the per-file reset. Each case dirties one class of state the way a real file did (see the
// table in ./sharedWorkerHygiene.ts), calls the reset and checks it is back to what the worker started with. The
// cross-FILE behaviour on the gate's batch thread is pinned by scripts/vitest-gate-batch-hygiene.self-test.mjs.
describe("resetSharedWorkerState", () => {
  afterEach(() => {
    resetSharedWorkerState();
  });

  it("puts the jsdom URL back after app code moved it (history.replaceState on the checkout pages)", () => {
    window.history.replaceState(null, "", "/book/qa-prop/unit-1/details?tenant=qa-bot-c59de6#cancellation-refunds");
    expect(window.location.search).toBe("?tenant=qa-bot-c59de6");
    resetSharedWorkerState();
    expect(window.location.href).toBe("http://localhost:3000/");
  });

  it("restores a window.location that a test replaced with a plain object", () => {
    delete (window as unknown as { location?: unknown }).location;
    (window as unknown as { location: unknown }).location = { href: "https://qa.example/x?tenant=t", search: "?tenant=t" };
    expect(window.location.search).toBe("?tenant=t");
    resetSharedWorkerState();
    expect(Object.prototype.toString.call(window.location)).toBe("[object Location]");
    expect(window.location.search).toBe("");
  });

  it("clears web storage and cookies", () => {
    window.localStorage.setItem("atlas_guest_auth", '{"isAuthenticated":true}');
    window.sessionStorage.setItem("atlas_guest_checkout_hold", "{}");
    document.cookie = "consent=1; path=/";
    resetSharedWorkerState();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("removes page-level head tags and stray body nodes but keeps stylesheets", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    const canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    const sheet = document.createElement("style");
    sheet.id = "keep-me";
    const stray = document.createElement("div");
    document.head.append(meta, canonical, sheet);
    document.body.append(stray);
    resetSharedWorkerState();
    expect(document.head.contains(meta)).toBe(false);
    expect(document.head.contains(canonical)).toBe(false);
    expect(document.body.contains(stray)).toBe(false);
    expect(document.head.contains(sheet)).toBe(true);
    sheet.remove();
  });

  it("restores html and body attributes", () => {
    document.documentElement.setAttribute("data-theme", "noir");
    document.body.style.overflow = "hidden";
    resetSharedWorkerState();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.body.hasAttribute("style")).toBe(false);
  });

  it("removes an SDK global a test assigned and restores a viewport width it redefined", () => {
    (window as unknown as { Razorpay?: unknown }).Razorpay = function RazorpayMock() {};
    Object.defineProperty(window, "innerWidth", { value: 375, writable: true, configurable: true });
    resetSharedWorkerState();
    expect((window as unknown as { Razorpay?: unknown }).Razorpay).toBeUndefined();
    expect(window.innerWidth).toBe(1024);
  });

  it("undoes vi.stubGlobal, vi.stubEnv and fake timers", () => {
    vi.stubGlobal("atlasHygieneProbe", 1);
    vi.stubEnv("ATLAS_HYGIENE_PROBE", "1");
    vi.useFakeTimers();
    resetSharedWorkerState();
    expect((globalThis as Record<string, unknown>).atlasHygieneProbe).toBeUndefined();
    expect(process.env.ATLAS_HYGIENE_PROBE).toBeUndefined();
    expect(vi.isFakeTimers()).toBe(false);
  });

  it("is idempotent", () => {
    resetSharedWorkerState();
    expect(() => resetSharedWorkerState()).not.toThrow();
    expect(window.location.href).toBe("http://localhost:3000/");
  });
});
