import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

/**
 * TASK-102734, done-when 1(a): `settle()` against `waitFor()` when one step of an already-resolved mocked chain holds
 * the thread longer than the wait window (a stand-in for a starved worker, exactly as the entry specifies).
 *
 * Default run: scaled down (300 ms hold, 100 ms window) and asserts only what must ALWAYS hold - `settle()` completes
 * the chain and never depends on a clock - so this file can never become a new source of load-sensitive reds.
 *
 * Full-scale reproduction of the entry (1.2 s hold against waitFor's default 1,000 ms window), which ALSO asserts that
 * the old `waitFor` form fails with the gate's message:
 *
 *   ATLAS_WAITFOR_REPRO=1 npx vitest run src/test/settle.test.tsx
 *
 * Measured 2026-09-30 (hook form, 16 runs): old form red 16/16 ("expected null to be 1.25"), settle() green 16/16.
 * The failing order, from an instrumented run: the render lands, then the overdue 50 ms poll and 1,000 ms deadline
 * timers fire, THEN the passive effect that publishes `renderHook`'s `result.current` (a second Scheduler task).
 */
const REPRO = process.env.ATLAS_WAITFOR_REPRO === "1";
const HOLD_MS = REPRO ? 1200 : 300;
const WINDOW_MS = REPRO ? 1000 : 100;

function holdThread(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* nothing else on this worker runs meanwhile, like a starved worker */
  }
}

/** The same shape as useTenantProcessingFee: effect -> fetch -> response.json() -> setState. */
function useFee(): number | null {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/fee")
      .then((response) => response.json() as Promise<{ percent: number }>)
      .then((data) => {
        if (!cancelled) setValue(data.percent);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return value;
}

function stubFee(holdMs: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        if (holdMs) holdThread(holdMs);
        return { percent: 1.25 };
      },
    }),
  );
}

function FeeText() {
  const fee = useFee();
  return <p>{fee === null ? "loading" : `fee ${fee}%`}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("settle() vs a wall-clock wait when the thread is held (TASK-102734)", () => {
  it("renderHook: settle() publishes result.current after a held step", async () => {
    if (REPRO) {
      stubFee(HOLD_MS);
      const old = renderHook(() => useFee());
      let oldFormFailed = false;
      try {
        // wall-clock: deliberately the OLD form, to show it fails when the thread is held past its window
        await waitFor(() => expect(old.result.current).toBe(1.25), { timeout: WINDOW_MS });
      } catch {
        oldFormFailed = true;
      }
      old.unmount();
      expect(oldFormFailed).toBe(true);
    }

    stubFee(HOLD_MS);
    const hook = renderHook(() => useFee());
    expect(hook.result.current).toBeNull();
    await settle();
    expect(hook.result.current).toBe(1.25);
  });

  it("DOM: settle() shows the resolved text after a held step", async () => {
    stubFee(HOLD_MS);
    render(<FeeText />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await settle();
    expect(screen.getByText("fee 1.25%")).toBeInTheDocument();
  });

  it("does not hang when setTimeout is faked, and still drains the chain and a 0 ms timer", async () => {
    vi.useFakeTimers();
    let ticked = false;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          setTimeout(() => {
            ticked = true;
          }, 0);
          return { percent: 2.5 };
        },
      }),
    );
    render(<FeeText />);
    await settle();
    expect(screen.getByText("fee 2.5%")).toBeInTheDocument();
    expect(ticked).toBe(true);
  });

  it("drains state set from a promise continuation outside any React event (act queue, not the Scheduler)", async () => {
    let resolveLater!: () => void;
    const gate = new Promise<void>((resolve) => {
      resolveLater = resolve;
    });
    function Gated() {
      const [done, setDone] = useState(false);
      useEffect(() => {
        void gate.then(() => setDone(true));
      }, []);
      return <p>{done ? "open" : "closed"}</p>;
    }
    render(<Gated />);
    expect(screen.getByText("closed")).toBeInTheDocument();
    resolveLater();
    await settle();
    expect(screen.getByText("open")).toBeInTheDocument();
    // act() must not have been left open: a follow-up act still works.
    await act(async () => {});
  });
});
