/**
 * Undo a per-instance override of `document.visibilityState` left behind by an earlier test file.
 *
 * WHY (TASK-102734). The `shared-fast` project runs with `isolate: false`, so every file a worker runs shares ONE
 * jsdom `document`. `GuestDetailsPage.abandonOnDeparture.test.tsx` simulates a hidden tab with
 * `Object.defineProperty(document, "visibilityState", { value: "hidden" })` and its last test never puts it back, so
 * the NEXT file that worker runs starts with a hidden tab. `useTenantProcessingFee` returns early from `refresh()`
 * while the tab is hidden, so `src/hooks/useTenantProcessingFee.test.tsx` then reads `null` forever and fails after
 * two 1,000 ms `waitFor` timeouts, exactly the release-gate STEP 1 signature of 2026-09-30 ("expected null to be
 * 1.25", `(7 tests | 2 failed) 2095ms`). Whether it fails depends only on which file the worker happened to run
 * first, so it correlates with load (scheduling shifts under load) without being caused by a slow worker.
 * Reproduced deterministically with `ATLAS_GUEST_VITEST_MAX_WORKERS=1 npx vitest run --project shared-fast
 * --maxWorkers=1 <abandonOnDeparture test> <useTenantProcessingFee test>`; `settle()` does not cure it.
 *
 * Deleting the own property restores jsdom's prototype getter ("visible"). Called from `src/test/setup.ts`, which
 * re-executes at the start of every test file, so a leak is confined to the file that caused it.
 */
export function restoreDocumentVisibility(): void {
  if (typeof document === "undefined") return;
  if (Object.prototype.hasOwnProperty.call(document, "visibilityState")) {
    delete (document as unknown as { visibilityState?: unknown }).visibilityState;
  }
}
