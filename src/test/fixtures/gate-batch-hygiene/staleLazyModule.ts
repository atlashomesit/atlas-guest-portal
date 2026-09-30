import { setTimeout as sleep } from "node:timers/promises";

// Support module for the gate-batch hygiene guard: stands in for a `React.lazy` route chunk that is still being fetched
// when a file ends. It records which test file was current when it finished evaluating, so the second fixture can tell
// "finished inside the file that started it" (drained) from "finished inside the next file" (leaked).
// `node:timers/promises` is used because the first fixture turns fake timers on: this sleep must stay real.
await sleep(250);
(globalThis as unknown as Record<string, unknown>).__gateBatchHygieneStaleEvaluatedDuring = String(
  (globalThis as unknown as { __vitest_worker__?: { filepath?: string } }).__vitest_worker__?.filepath ?? "unknown",
).replace(/\\/g, "/");
