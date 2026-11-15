import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  FRESH_WORKER_FILES,
  IsolatedBatchForksWorker,
  MAX_FILES_PER_WORKER,
  extractMessageFilepaths,
  forceWorkerFileIsolation,
  isFreshWorkerFile,
} from "./vitest-isolated-batch-pool.mjs";

// 1. Protocol message isolation tests
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

const collect = {
  type: "collect",
  context: { config: { isolate: false }, files: [{ filepath: "b.test.ts" }] },
};
assert.equal(forceWorkerFileIsolation(collect).context.config.isolate, true);

// 2. Filepath extraction & fresh-worker file matching
assert.equal(MAX_FILES_PER_WORKER, 60, "default MAX_FILES_PER_WORKER should be 60");
assert.deepEqual(
  extractMessageFilepaths({
    type: "run",
    context: {
      files: [
        "src\\pages\\Foo.test.tsx",
        { filepath: "C:\\AtlasWork\\wt\\guest\\src\\components\\Bar.test.tsx" },
      ],
    },
  }),
  ["src/pages/Foo.test.tsx", "C:/AtlasWork/wt/guest/src/components/Bar.test.tsx"],
);

assert.equal(FRESH_WORKER_FILES.length, 7, "all 7 gateFreshFiles must be listed");
for (const freshRel of FRESH_WORKER_FILES) {
  assert.equal(isFreshWorkerFile(freshRel), true, `relative path should match: ${freshRel}`);
  assert.equal(
    isFreshWorkerFile(`C:\\AtlasHomestays\\code\\atlas-guest-portal\\${freshRel.replace(/\//g, "\\")}`),
    true,
    `Windows absolute path should match: ${freshRel}`,
  );
}
assert.equal(isFreshWorkerFile("src/pages/Terms.test.tsx"), false);

// 3. Forked child_process worker recycling & PoolRunner contract tests
const spawnedChildren = [];
class FakeForkChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  messages = [];
  killed = false;
  exitCode = null;
  signalCode = null;

  constructor(entrypoint, args, options) {
    super();
    this.entrypoint = entrypoint;
    this.args = args;
    this.options = options;
    spawnedChildren.push(this);
  }

  send(msg) {
    this.messages.push(msg);
    if (msg?.type === "start") {
      queueMicrotask(() => {
        this.emit("message", { type: "started", __vitest_worker_response__: true });
      });
    } else if (msg?.type === "run" || msg?.type === "collect") {
      queueMicrotask(() => {
        this.emit("message", {
          type: "testfileFinished",
          __vitest_worker_response__: true,
          childIndex: spawnedChildren.indexOf(this),
          files: extractMessageFilepaths(msg),
        });
      });
    }
  }

  kill(signal) {
    this.killed = true;
    this.exitCode = 0;
    this.signalCode = signal ?? "SIGTERM";
    queueMicrotask(() => {
      this.stdout.end();
      this.stderr.end();
      this.emit("exit", 0, this.signalCode);
    });
    return true;
  }
}

const outStream = new PassThrough();
const errStream = new PassThrough();
const baseMaxListeners = outStream.getMaxListeners();

const poolWorker = new IsolatedBatchForksWorker({
  distPath: "C:/fake/vitest/dist",
  execArgv: [],
  env: { ATLAS_VITEST_BATCH_RECYCLE_EVERY: "3" },
  forkFn: (ep, args, opts) => new FakeForkChild(ep, args, opts),
  project: {
    vitest: {
      logger: { outputStream: outStream, errorStream: errStream },
    },
  },
});

const receivedMessages = [];
const receivedErrors = [];
const receivedExits = [];

await poolWorker.start();
assert.equal(
  spawnedChildren[0].entrypoint.replace(/\\/g, "/").endsWith("workers/forks.js"),
  true,
  "must spawn Vitest's child_process forks worker entrypoint (workers/forks.js)",
);

poolWorker.on("message", (msg) => receivedMessages.push(msg));
poolWorker.on("error", (err) => receivedErrors.push(err));
poolWorker.on("exit", (code) => receivedExits.push(code));

const waitNextFinished = () =>
  new Promise((resolve) => {
    const handler = (msg) => {
      if (msg?.type === "testfileFinished") {
        poolWorker.off("message", handler);
        resolve(msg);
      }
    };
    poolWorker.on("message", handler);
  });

const initialStarted = new Promise((resolve) => {
  const handler = (msg) => {
    if (msg?.type === "started") {
      poolWorker.off("message", handler);
      resolve(msg);
    }
  };
  poolWorker.on("message", handler);
});
poolWorker.send(start);
await initialStarted;
assert.equal(spawnedChildren.length, 1);

const sendFile = async (filepath) => {
  const done = waitNextFinished();
  poolWorker.send({
    type: "run",
    context: { config: { isolate: false }, files: [{ filepath }] },
  });
  return done;
};

// Files 1, 2, 3 reuse child process 0
const r1 = await sendFile("C:\\repo\\src\\pages\\A.test.tsx");
const r2 = await sendFile("C:\\repo\\src\\pages\\B.test.tsx");
const r3 = await sendFile("C:\\repo\\src\\pages\\C.test.tsx");
assert.deepEqual([r1.childIndex, r2.childIndex, r3.childIndex], [0, 0, 0]);
assert.equal(spawnedChildren.length, 1);

// File 4 hits MAX_FILES_PER_WORKER=3 -> recycles cleanly onto child process 1
const r4 = await sendFile("C:\\repo\\src\\pages\\D.test.tsx");
assert.equal(r4.childIndex, 1, "4th file must run on recycled child process 1");
assert.equal(spawnedChildren[0].killed, true, "old child process must be terminated");
assert.equal(receivedExits.length, 0, "recycle termination must NOT emit unexpected exit to PoolRunner");
assert.equal(receivedErrors.length, 0, "recycle termination must NOT emit error to PoolRunner");
assert.equal(
  receivedMessages.filter((m) => m?.type === "started").length,
  1,
  "internal recycle re-handshake 'started' must NOT leak to outer PoolRunner listeners",
);

// Fresh file after normal file -> recycles immediately onto child process 2
const r5 = await sendFile("C:\\repo\\src\\pages\\home\\__tests__\\Home.test.tsx");
assert.equal(r5.childIndex, 2, "fresh-worker file must get a brand-new child process");

// Normal file immediately after fresh file -> recycles onto child process 3
const r6 = await sendFile("C:\\repo\\src\\pages\\E.test.tsx");
assert.equal(r6.childIndex, 3, "file following a fresh-worker file must also get a clean child process");

await poolWorker.stop();
assert.equal(spawnedChildren[3].killed, true);
assert.equal(
  outStream.getMaxListeners(),
  baseMaxListeners,
  "stdout maxListeners must return to baseline after recycling and stop()",
);
assert.equal(
  errStream.getMaxListeners(),
  baseMaxListeners,
  "stderr maxListeners must return to baseline after recycling and stop()",
);

console.log("PASS vitest isolated-batch forks pool protocol & recycling self-test");
