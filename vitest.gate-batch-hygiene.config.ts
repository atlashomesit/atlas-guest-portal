import { BaseSequencer } from "vitest/node";
import base from "./vitest.config";

// Config for scripts/vitest-gate-batch-hygiene.self-test.mjs (TASK-102734): runs the two hygiene fixtures on ONE reused
// thread of the gate's batch pool, in order. It takes the production `mocked-isolated` project from vitest.config.ts
// as-is (environment, pool, isolate flag, timeouts, setup files) and only swaps the include list, so the topology under
// test cannot drift from the one `npm run test:gate` runs.
if (process.env.ATLAS_VITEST_GATE_BATCH !== "1") {
  throw new Error(
    "vitest.gate-batch-hygiene.config.ts only means anything under ATLAS_VITEST_GATE_BATCH=1 (the batch-pool topology); " +
      "run it through scripts/vitest-gate-batch-hygiene.self-test.mjs.",
  );
}

// Fixture 1 must run before fixture 2, and the default sequencer orders by cached duration (which moves).
class FixtureOrderSequencer extends BaseSequencer {
  async sort(files: Array<{ moduleId: string }>) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
  async shard(files: Array<{ moduleId: string }>) {
    return files;
  }
}

const anyBase = base as any;
const production = anyBase.test.projects.find((p: any) => p.test?.name === "mocked-isolated");
if (!production) throw new Error("vitest.config.ts no longer defines a `mocked-isolated` project");

// --negative-control: drop the reset setup file so the fixtures prove they can fail. Never set by `npm run test:gate`.
const withoutReset = process.env.ATLAS_HYGIENE_SELFTEST_NO_RESET === "1";
const setupFiles: string[] = production.test.setupFiles.filter(
  (f: string) => !(withoutReset && f.includes("sharedWorkerResetSetup")),
);

// The pair MUST share one thread and run in order, whatever ATLAS_GUEST_VITEST_MAX_WORKERS says: the release gate may set
// it to 3, which gives the production project three batch threads and parallel files (the first version of this guard
// inherited that and its own same-thread check refused to pass).
const oneThread = { maxWorkers: 1, fileParallelism: false };

export default {
  ...anyBase,
  test: {
    ...anyBase.test,
    ...oneThread,
    sequence: { ...(anyBase.test.sequence ?? {}), sequencer: FixtureOrderSequencer },
    projects: [
      {
        ...production,
        test: {
          ...production.test,
          ...oneThread,
          include: ["src/test/fixtures/gate-batch-hygiene/*.fixture.ts"],
          setupFiles,
        },
      },
    ],
  },
};
