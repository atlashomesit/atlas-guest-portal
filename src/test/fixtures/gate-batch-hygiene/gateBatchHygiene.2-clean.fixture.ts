import { describe, expect, it, vi } from "vitest";
import { threadId } from "node:worker_threads";

/**
 * FIXTURE, not a test. File 2 of 2 of the gate-batch hygiene guard (see gateBatchHygiene.1-dirty.fixture.ts): it runs
 * right after file 1 on the same reused worker thread and asserts that none of what file 1 left behind is visible.
 * Every `it` maps to one class of leak measured in the guest suite (TASK-102734) and to one step of
 * src/test/sharedWorkerHygiene.ts; scripts/vitest-gate-batch-hygiene.self-test.mjs --negative-control removes the
 * reset and requires each of them (bar the timing-based last one) to go red.
 */
const g = globalThis as unknown as Record<string, unknown>;

describe("gate-batch hygiene fixture 2 of 2: nothing the previous file left is visible", () => {
  it("ran on the SAME reused batch thread as fixture 1 (otherwise every other case here proves nothing)", () => {
    expect(process.env.ATLAS_VITEST_GATE_BATCH).toBe("1");
    expect(g.__gateBatchHygieneDirtyThread).toBe(threadId);
  });

  it("the jsdom URL and window.location are back to the worker's starting state", () => {
    expect(Object.prototype.toString.call(window.location)).toBe("[object Location]");
    expect(window.location.href).toBe("http://localhost:3000/");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("web storage and cookies are empty", () => {
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("document title, head and body carry nothing over", () => {
    expect(document.title).toBe("");
    expect(document.head.querySelector('meta[name="leaked-meta"]')).toBeNull();
    expect(document.head.querySelector("#leaked-script")).toBeNull();
    expect(document.body.querySelector("#leaked-body-node")).toBeNull();
  });

  it("html and body attributes carry nothing over", () => {
    expect(document.documentElement.hasAttribute("data-leaked")).toBe(false);
    expect(document.body.getAttribute("style")).toBeNull();
  });

  it("document.visibilityState is visible again", () => {
    expect(document.visibilityState).toBe("visible");
  });

  it("SDK globals and replaced window properties are re-armed", () => {
    expect((window as unknown as { Razorpay?: unknown }).Razorpay).toBeUndefined();
    expect(window.innerWidth).toBe(1024);
    expect(vi.isMockFunction(window.scrollTo)).toBe(false);
  });

  it("vi.stubGlobal, vi.stubEnv and fake timers are undone", () => {
    expect(g.leakedStubbedGlobal).toBeUndefined();
    expect(process.env.LEAKED_STUBBED_ENV).toBeUndefined();
    expect(vi.isFakeTimers()).toBe(false);
  });

  it("a vi.doMock queued at the end of the previous file does not apply to this file", async () => {
    const real = await import("./realModule");
    expect(real.realValue).toBe(42);
    expect((real as unknown as Record<string, unknown>).LEAKED_MOCK).toBeUndefined();
  });

  // Timing-based in the negative control (the stale import can win the race and land in the gap between the two files),
  // exact in the real run: the drain makes the import finish while fixture 1 is still the current file.
  it("a dynamic import in flight when the previous file ended finished INSIDE that file", () => {
    expect(String(g.__gateBatchHygieneStaleEvaluatedDuring)).toMatch(/gateBatchHygiene\.1-dirty\.fixture\.ts$/);
  });
});
