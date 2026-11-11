import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Drain already-resolved async work deterministically, instead of polling it against a wall-clock deadline.
 *
 * WHY THIS EXISTS (TASK-102734). `waitFor()` and `findBy*()` arm one real `setTimeout` deadline (1,000 ms by
 * default) and reject with the LAST error they saw when it fires. They run with IS_REACT_ACT_ENVIRONMENT off, so
 * React commits their state updates through the Scheduler (a `setImmediate` per task), and a `renderHook`
 * `result.current` is only published by a passive effect, which is a SECOND Scheduler task. When the worker is
 * starved (the release gate's STEP 1 runs this suite beside the API compile), an overdue deadline runs in the timers
 * phase BETWEEN those tasks: the last check reads the stale value and the wait rejects, although nothing is wrong.
 * Measured 2026-09-30 by holding the thread 1.2 s inside a mocked `response.json()`: a default-timeout `waitFor`
 * on a `renderHook` value failed 16 of 16 runs; a DOM `findByText`/`waitFor` failed every run armed from the check
 * phase (right after any `await act(...)`) and passed those armed from the timers phase; this helper passed 32 of 32
 * across both. See docs/testing/waitfor-audit-2026-09-30.md.
 *
 * WHAT IT DOES. It runs one macrotask tick inside an async `act()`. While the act scope is open React queues every
 * state update in the act queue instead of the Scheduler, so the scope drains every already-resolved promise step
 * (fetch mock -> response.json() -> setState -> effects -> the next mocked call ...) AND commits AND flushes passive
 * effects before it resolves. It waits for an ORDER (the chain finished), never for a TIME, so machine load cannot
 * change the outcome.
 *
 * WHEN IT IS NOT ENOUGH. The awaited work must be promises, microtasks or 0 ms timers that the test itself controls.
 * It does NOT wait for a component's own debounce/animation timer or for real I/O (a `React.lazy` chunk import): for
 * a timer you control, install fake timers and use `vi.advanceTimersByTimeAsync(ms)`; for a lazy module, `await
 * import()` it first; for genuinely real work keep `waitFor` with an explicit `timeout` and a `// wall-clock: <why>`
 * comment (eslint-rules/no-wall-clock-wait.cjs enforces that).
 *
 * Fake timers: when `setTimeout` is faked (sinon marks the fake with a `clock` property, the same test
 * @testing-library/dom uses) a real `setTimeout(0)` would never fire, so the tick is `advanceTimersByTimeAsync(0)`.
 */
export async function settle(): Promise<void> {
  await act(async () => {
    if (Object.prototype.hasOwnProperty.call(setTimeout, "clock")) {
      await vi.advanceTimersByTimeAsync(0);
    } else {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  });
}
