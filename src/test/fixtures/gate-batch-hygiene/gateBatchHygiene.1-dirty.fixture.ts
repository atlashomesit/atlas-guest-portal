import { describe, expect, it, vi } from "vitest";
import { threadId } from "node:worker_threads";
import { setTimeout as sleep } from "node:timers/promises";
import { queuedMockCount } from "../../sharedWorkerHygiene";

/**
 * FIXTURE, not a test (the `.fixture.ts` suffix keeps it out of vitest.config.ts's include lists). File 1 of 2 of the
 * gate-batch hygiene guard, run by scripts/vitest-gate-batch-hygiene.self-test.mjs through
 * vitest.gate-batch-hygiene.config.ts: the production `mocked-isolated` project (batch pool, one reused thread, same
 * setup files), pinned to run this file FIRST and gateBatchHygiene.2-clean.fixture.ts right after it.
 *
 * It leaves every class of cross-file state that src/test/sharedWorkerHygiene.ts claims to reset in the shared
 * thread, each one shaped like a real leak measured in the guest suite (TASK-102734). The second file asserts that
 * none of it is visible. Add a new class of leak here AND an assertion in the second file.
 */
const g = globalThis as unknown as Record<string, unknown>;

describe("gate-batch hygiene fixture 1 of 2: leave the reused worker dirty", () => {
  it("dirties every class of state the per-file reset covers", async () => {
    g.__gateBatchHygieneDirtyThread = threadId;

    // GuestCheckoutTenantSlugParity: the checkout page rewrote the URL with history.replaceState.
    window.history.replaceState(null, "", "/leaked/path?tenant=qa-bot-c59de6#leaked-hash");
    // MyBookingsPage.errorStates: a real login persisted a session; the checkout flows persist a hold and a draft.
    window.localStorage.setItem("atlas_guest_auth", '{"isAuthenticated":true,"token":"leaked-jwt"}');
    window.sessionStorage.setItem("atlas_guest_checkout_hold", '{"holdId":1}');
    document.cookie = "leaked-cookie=1; path=/";
    // SEO components and analytics loaders write page-level tags and never remove them.
    document.title = "leaked-title";
    const meta = document.createElement("meta");
    meta.setAttribute("name", "leaked-meta");
    document.head.appendChild(meta);
    const script = document.createElement("script");
    script.id = "leaked-script";
    document.head.appendChild(script);
    const stray = document.createElement("div");
    stray.id = "leaked-body-node";
    document.body.appendChild(stray);
    document.documentElement.setAttribute("data-leaked", "1");
    document.body.setAttribute("style", "overflow: hidden");
    // GuestDetailsPage.abandonOnDeparture: a pinned hidden tab.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    // GuestCheckoutTenantSlugParity: an SDK mock by plain assignment; smoke tests and others: viewport and scrollTo.
    (window as unknown as { Razorpay?: unknown }).Razorpay = function RazorpayMock() {};
    Object.defineProperty(window, "innerWidth", { value: 375, writable: true, configurable: true });
    window.scrollTo = vi.fn();
    vi.stubGlobal("leakedStubbedGlobal", 1);
    vi.stubEnv("LEAKED_STUBBED_ENV", "1");
    // A lazy import that is started and not awaited (the tests/smokeBookingFlow shape): it lands after this file's
    // last test unless the hygiene drain waits for it. Its module fetch flushes the mock queue, so the real sleep lets
    // that fetch happen BEFORE the mock below is queued (node:timers/promises stays real under fake timers).
    void import("./staleLazyModule");
    await sleep(50);
    // A vi.doMock nobody imports after: it is only QUEUED (the favorites-sync-and-reminder shape) and no later module
    // fetch flushes it. Asserted, because a fixture whose mock was already flushed proves nothing (the first version
    // of this file was exactly that, and the negative control caught it).
    vi.doMock("./realModule", () => ({ LEAKED_MOCK: true }));
    expect(queuedMockCount(), "fixture is vacuous: the queued vi.doMock was flushed before the file ended").toBeGreaterThan(0);
    // ErrorBoundary / GuestCheckoutTenantSlugParity: window.location swapped for a plain object.
    delete (window as unknown as { location?: unknown }).location;
    (window as unknown as { location: unknown }).location = { href: "http://leaked.example/", search: "?tenant=leaked" };
    vi.useFakeTimers();
  });
});
