import { afterAll } from "vitest";
import { drainCrossFileAsyncState, resetSharedWorkerState } from "./sharedWorkerHygiene";

/**
 * FIRST entry in `setupFiles` (vitest.config.ts), ahead of src/test/setup.ts.
 *
 * Order matters. Under the gate's batch pool the module registry is reset per file, so every module that reads the
 * URL or web storage while it is being EVALUATED (`guestAuthStorage` reads localStorage at import) runs again for each
 * file. `setup.ts` imports a dozen of them, and ES imports are evaluated before its body, so a reset called from
 * `setup.ts` would run after they had already read the previous file's state. A separate, earlier setup file is
 * re-executed for every test file in every project, which is the point.
 *
 * See sharedWorkerHygiene.ts for what is reset and why. The guard that proves this file is doing its job is
 * `npm run test:gate`'s scripts/vitest-gate-batch-hygiene.self-test.mjs.
 */
resetSharedWorkerState();
afterAll(drainCrossFileAsyncState);
