import assert from "node:assert/strict";
import { forceWorkerFileIsolation } from "./vitest-isolated-batch-pool.mjs";

const untouchedStop = { type: "stop" };
assert.equal(forceWorkerFileIsolation(untouchedStop), untouchedStop);

const start = {
  type: "start",
  context: { config: { isolate: false, testTimeout: 120_000 }, pool: "atlas-isolated-batch" },
};
const isolated = forceWorkerFileIsolation(start);
assert.equal(start.context.config.isolate, false, "caller-owned protocol message must not be mutated");
assert.equal(isolated.context.config.isolate, true, "worker must receive per-file isolation");
assert.equal(isolated.context.config.testTimeout, 120_000, "unrelated config must survive");

const run = {
  type: "run",
  context: { config: { isolate: false }, files: ["a.test.ts"] },
};
const isolatedRun = forceWorkerFileIsolation(run);
assert.equal(run.context.config.isolate, false, "caller-owned task context must not be mutated");
assert.equal(isolatedRun.context.config.isolate, true, "every reused task must retain isolation");

console.log("PASS vitest isolated-batch pool protocol self-test");
