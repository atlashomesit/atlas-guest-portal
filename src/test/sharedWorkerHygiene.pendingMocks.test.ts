import { describe, expect, it, vi } from "vitest";
import { drainCrossFileAsyncState, moduleMocker, queuedMockCount } from "./sharedWorkerHygiene";

// TASK-102734: canary for the Vitest internals `drainCrossFileAsyncState` relies on (`__vitest_mocker__`,
// `resolveMocks`, the static `pendingIds` queue). If a Vitest upgrade moves them the drain would silently become a
// no-op and `orderRequestHeaders` would start receiving another file's `@/api/client` mock again on the gate's batch
// thread, at random, because of whichever file ran before it. This file fails loudly instead, in plain `npm test` too.
// (It contains a `vi.doMock`, so vitest.config.ts routes it to the mocked-isolated project on purpose.)
describe("drainCrossFileAsyncState: the Vitest internals it depends on", () => {
  it("exposes the module mocker and its resolveMocks()", () => {
    expect(typeof moduleMocker()?.resolveMocks).toBe("function");
  });

  it("a queued vi.doMock stays on the static pending queue until a fetch or the drain flushes it", async () => {
    expect(queuedMockCount()).toBe(0);
    vi.doMock("./fixtures/gate-batch-hygiene/realModule", () => ({ realValue: -1 }));
    expect(queuedMockCount()).toBe(1);
    await drainCrossFileAsyncState();
    expect(queuedMockCount()).toBe(0);
  });
});
