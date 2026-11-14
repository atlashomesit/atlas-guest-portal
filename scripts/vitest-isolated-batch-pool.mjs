import { fork } from "node:child_process";
import path from "node:path";

/**
 * Files proven to depend on a genuinely fresh module runner / jsdom environment
 * (mirrors `gateFreshFiles` in vitest.config.ts). Matched by normalized `/` suffix so
 * both repo-relative and absolute Windows/POSIX paths trigger worker recycling.
 */
export const FRESH_WORKER_FILES = [
  "src/api/client.getApiHeaders.test.ts",
  "src/components/homepage_components/slider/Slider.vrt.test.tsx",
  "src/pages/home/__tests__/Home.test.tsx",
  "src/pages/MyBookingsPage.dateTz.test.tsx",
  "src/pages/MyBookingsPage.reviewCta.test.tsx",
  "src/tenant/displayBrand.slots.test.tsx",
  "tests/DatePicker.test.tsx",
];

export const MAX_FILES_PER_WORKER =
  Number.parseInt(process.env.ATLAS_VITEST_BATCH_RECYCLE_EVERY ?? "60", 10) || 60;

const DEFAULT_START_HANDSHAKE_TIMEOUT_MS = 60_000;
const SIGKILL_TIMEOUT_MS = 500;
const PIPE_ERROR_EXIT_GRACE_MS = 1_000;
const noop = () => {};

/**
 * Keep Vitest's per-file mock/module reset while reusing forked child_process workers.
 *
 * Why child_process `forks` (`workers/forks.js`) instead of `worker_threads` (`workers/threads.js`):
 * Under Node 24 on Windows, concurrent `worker_threads` running jsdom/DOM/canvas suites in
 * `atlas-guest-portal` can trigger a native V8 access violation (`0xC0000005` / `-1073741819`),
 * killing the entire Vitest host process after only a few files. Using forked child processes
 * with `isolate: false` scheduling + `forceWorkerFileIsolation` (`isolate: true` per-file reset
 * inside the worker) and periodic process recycling every `MAX_FILES_PER_WORKER` files retains
 * the 3.5x `isolate: false` batch speedup while completely avoiding `worker_threads` V8 crashes.
 */
export function forceWorkerFileIsolation(message) {
  if (
    (message?.type !== "start" && message?.type !== "run" && message?.type !== "collect") ||
    !message.context?.config
  ) {
    return message;
  }
  return {
    ...message,
    context: {
      ...message.context,
      config: { ...message.context.config, isolate: true },
    },
  };
}

export function extractMessageFilepaths(message) {
  const rawFiles = message?.context?.files ?? message?.files;
  if (!Array.isArray(rawFiles)) return [];
  const paths = [];
  for (const entry of rawFiles) {
    const raw =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object" && typeof entry.filepath === "string"
          ? entry.filepath
          : null;
    if (raw) {
      paths.push(raw.replace(/\\/g, "/"));
    }
  }
  return paths;
}

export function isFreshWorkerFile(filepath, freshSuffixes = FRESH_WORKER_FILES) {
  const normalized = String(filepath ?? "").replace(/\\/g, "/");
  if (!normalized) return false;
  return freshSuffixes.some(
    (suffix) => normalized === suffix || normalized.endsWith(`/${suffix}`),
  );
}

function streamFlushed(stream) {
  if (!stream || stream.readableEnded || stream.destroyed || typeof stream.once !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    stream.once("end", resolve);
    stream.once("close", resolve);
  });
}

export class IsolatedBatchForksWorker {
  name = "atlas-isolated-batch";
  cacheFs = true;
  #entrypoint;
  #execArgv;
  #env;
  #child;
  #stdout;
  #stderr;
  #forkFn;
  #maxFilesPerWorker;
  #freshWorkerFiles;
  #handshakeTimeoutMs;
  #listeners = new Map();
  #childForwarders = new Map();
  #forwardingAttached = false;
  #startMessage;
  #filesRun = 0;
  #lastRunWasFreshFile = false;
  #sendQueue = Promise.resolve();
  #pendingQueueDepth = 0;
  #pipeErrorTimer;

  constructor(options) {
    this.#entrypoint = path.resolve(options.distPath, "workers/forks.js");
    this.#execArgv = options.execArgv;
    this.#env = options.env;
    this.#stdout = options.project.vitest.logger.outputStream;
    this.#stderr = options.project.vitest.logger.errorStream;
    this.#forkFn =
      options.forkFn ??
      (options.WorkerClass
        ? (ep, _args, opts) => new options.WorkerClass(ep, opts)
        : (ep, args, opts) => fork(ep, args, opts));
    const configuredMax = Number.parseInt(
      options.env?.ATLAS_VITEST_BATCH_RECYCLE_EVERY ??
        process.env.ATLAS_VITEST_BATCH_RECYCLE_EVERY ??
        "",
      10,
    );
    this.#maxFilesPerWorker =
      options.maxFilesPerWorker ?? (configuredMax > 0 ? configuredMax : MAX_FILES_PER_WORKER);
    this.#freshWorkerFiles = options.freshWorkerFiles ?? FRESH_WORKER_FILES;
    this.#handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_START_HANDSHAKE_TIMEOUT_MS;
  }

  on(event, callback) {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(callback);
    if (this.#child && this.#forwardingAttached) {
      this.#bindEventForwarder(this.#child, event);
    }
  }

  off(event, callback) {
    const set = this.#listeners.get(event);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0 && event !== "error" && this.#child && this.#childForwarders.has(event)) {
      this.#child.off(event, this.#childForwarders.get(event));
      this.#childForwarders.delete(event);
    }
  }

  send(message) {
    if (message?.type === "start") {
      this.#startMessage = message;
      this.#filesRun = 0;
      this.#lastRunWasFreshFile = false;
      this.#postToChild(this.#getChild(), forceWorkerFileIsolation(message));
      return;
    }

    if (message?.type === "run" || message?.type === "collect") {
      const filepaths = extractMessageFilepaths(message);
      const targetIsFreshFile = filepaths.some((fp) =>
        isFreshWorkerFile(fp, this.#freshWorkerFiles),
      );
      const fileCount = Math.max(1, filepaths.length);
      const needsRecycle =
        this.#filesRun > 0 &&
        (targetIsFreshFile ||
          this.#lastRunWasFreshFile ||
          this.#filesRun >= this.#maxFilesPerWorker);

      if (!needsRecycle && this.#pendingQueueDepth === 0) {
        this.#filesRun += fileCount;
        this.#lastRunWasFreshFile = targetIsFreshFile;
        this.#postToChild(this.#getChild(), forceWorkerFileIsolation(message));
        return;
      }

      this.#enqueue(async () => {
        const shouldRecycleNow =
          this.#filesRun > 0 &&
          (targetIsFreshFile ||
            this.#lastRunWasFreshFile ||
            this.#filesRun >= this.#maxFilesPerWorker);
        if (shouldRecycleNow) {
          await this.#recycleChild();
          this.#filesRun = fileCount;
        } else {
          this.#filesRun += fileCount;
        }
        this.#lastRunWasFreshFile = targetIsFreshFile;
        this.#postToChild(this.#getChild(), forceWorkerFileIsolation(message));
      });
      return;
    }

    if (message?.type === "stop") {
      if (this.#pendingQueueDepth === 0) {
        this.#postToChild(this.#getChild(), forceWorkerFileIsolation(message));
      } else {
        this.#enqueue(async () => {
          if (this.#child) {
            this.#postToChild(this.#child, forceWorkerFileIsolation(message));
          }
        });
      }
      return;
    }

    // Non-lifecycle messages (birpc responses/events) are posted directly to the active child so
    // RPC calls during a recycled worker's start handshake never block behind #sendQueue.
    this.#postToChild(this.#getChild(), forceWorkerFileIsolation(message));
  }

  async start() {
    if (this.#child) return;
    const child = this.#spawnChild();
    this.#child = child;
    this.#attachForwarding(child);
  }

  async stop() {
    if (this.#pendingQueueDepth > 0) {
      await this.#sendQueue.catch(noop);
    }
    const child = this.#getChild();
    this.#child = undefined;
    await this.#terminateChild(child);
  }

  deserialize(data) {
    return data;
  }

  #postToChild(child, payload) {
    if (typeof child.send === "function") {
      child.send(payload);
    } else if (typeof child.postMessage === "function") {
      child.postMessage(payload);
    } else {
      throw new Error("Isolated-batch child worker supports neither send() nor postMessage().");
    }
  }

  #spawnChild() {
    const child = this.#forkFn(this.#entrypoint, [], {
      env: this.#env,
      execArgv: this.#execArgv,
      stdio: "pipe",
      serialization: "advanced",
    });
    if (child.stdout && this.#stdout) {
      this.#stdout.setMaxListeners(this.#stdout.getMaxListeners() + 1);
      child.stdout.pipe(this.#stdout, { end: false });
    }
    if (child.stderr && this.#stderr) {
      this.#stderr.setMaxListeners(this.#stderr.getMaxListeners() + 1);
      child.stderr.pipe(this.#stderr, { end: false });
    }
    return child;
  }

  async #terminateChild(child) {
    if (this.#pipeErrorTimer) {
      clearTimeout(this.#pipeErrorTimer);
      this.#pipeErrorTimer = undefined;
    }
    this.#detachForwarding(child);
    // Keep a no-op error listener attached during termination so Node never throws an
    // unhandled 'error' event if a dying child process emits late IPC channel/EPIPE errors.
    child.on("error", noop);

    if (typeof child.terminate === "function") {
      const waitStdio = Promise.all([streamFlushed(child.stdout), streamFlushed(child.stderr)]);
      await child.terminate();
      await waitStdio;
    } else {
      const waitForExit = new Promise((resolve) => {
        if (child.exitCode != null || child.signalCode != null) {
          resolve();
        } else {
          child.once("exit", resolve);
        }
      });
      const sigkillTimeout = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already exited */
        }
      }, SIGKILL_TIMEOUT_MS);
      sigkillTimeout.unref?.();
      try {
        child.kill();
      } catch {
        /* already exited */
      }
      await waitForExit;
      clearTimeout(sigkillTimeout);
      if (child.stdout) await streamFlushed(child.stdout);
      if (child.stderr) await streamFlushed(child.stderr);
    }

    if (child.stdout && this.#stdout) {
      child.stdout.unpipe(this.#stdout);
      this.#stdout.setMaxListeners(Math.max(0, this.#stdout.getMaxListeners() - 1));
    }
    if (child.stderr && this.#stderr) {
      child.stderr.unpipe(this.#stderr);
      this.#stderr.setMaxListeners(Math.max(0, this.#stderr.getMaxListeners() - 1));
    }
  }

  async #recycleChild() {
    if (!this.#startMessage) {
      throw new Error("Cannot recycle isolated-batch worker before initial start message.");
    }
    const oldChild = this.#getChild();
    this.#child = undefined;
    await this.#terminateChild(oldChild);

    const newChild = this.#spawnChild();
    this.#child = newChild;
    await this.#performStartHandshake(newChild);
    this.#attachForwarding(newChild);
  }

  #performStartHandshake(child) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        finish(new Error("[atlas-isolated-batch]: Timeout waiting for recycled worker to start."));
      }, this.#handshakeTimeoutMs);
      timer.unref?.();

      const cleanup = () => {
        clearTimeout(timer);
        child.off("message", onMessage);
        child.off("error", onError);
        child.off("exit", onExit);
      };

      const finish = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };

      const onMessage = (raw) => {
        let parsed;
        try {
          parsed = this.deserialize(raw);
        } catch (err) {
          finish(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        if (parsed && typeof parsed === "object" && parsed.type === "started") {
          if (parsed.error) {
            const err =
              parsed.error instanceof Error
                ? parsed.error
                : new Error(String(parsed.error?.message ?? parsed.error));
            finish(err);
          } else {
            finish(null);
          }
          return;
        }
        // Forward non-"started" messages (e.g. birpc fetch/resolve calls during setup)
        // to outer listeners so worker setup RPC works identically on recycled workers.
        this.#emitToOuter("message", raw);
      };

      const onError = (err) => {
        finish(err instanceof Error ? err : new Error(String(err)));
      };

      const onExit = (code) => {
        finish(
          new Error(
            `[atlas-isolated-batch]: Recycled worker exited with code ${code} before signaling started.`,
          ),
        );
      };

      child.on("message", onMessage);
      child.on("error", onError);
      child.on("exit", onExit);
      this.#postToChild(child, forceWorkerFileIsolation(this.#startMessage));
    });
  }

  #enqueue(task) {
    this.#pendingQueueDepth += 1;
    const next = this.#sendQueue.then(task);
    this.#sendQueue = next
      .catch((error) => {
        this.#emitToOuter("error", error instanceof Error ? error : new Error(String(error)));
      })
      .finally(() => {
        this.#pendingQueueDepth -= 1;
      });
    return this.#sendQueue;
  }

  #attachForwarding(child) {
    this.#forwardingAttached = true;
    // Always bind error forwarder so an unexpected worker error never triggers Node's default crash.
    this.#bindEventForwarder(child, "error");
    for (const event of this.#listeners.keys()) {
      this.#bindEventForwarder(child, event);
    }
  }

  #detachForwarding(child) {
    this.#forwardingAttached = false;
    for (const [event, forwarder] of this.#childForwarders.entries()) {
      child.off(event, forwarder);
    }
    this.#childForwarders.clear();
  }

  #bindEventForwarder(child, event) {
    if (this.#childForwarders.has(event)) return;
    const forwarder = (...args) => {
      if (event === "error") {
        const error = args[0];
        const code = error?.code;
        if (code === "EPIPE" || code === "ERR_IPC_CHANNEL_CLOSED") {
          if (this.#pipeErrorTimer) return;
          this.#pipeErrorTimer = setTimeout(() => {
            this.#pipeErrorTimer = undefined;
            const active = this.#child;
            if (active && active.exitCode == null && active.signalCode == null) {
              this.#emitToOuter("error", error);
            }
          }, PIPE_ERROR_EXIT_GRACE_MS);
          this.#pipeErrorTimer.unref?.();
          return;
        }
      }
      this.#emitToOuter(event, ...args);
    };
    this.#childForwarders.set(event, forwarder);
    child.on(event, forwarder);
  }

  #emitToOuter(event, ...args) {
    const callbacks = this.#listeners.get(event);
    if (!callbacks || callbacks.size === 0) return;
    for (const cb of Array.from(callbacks)) {
      cb(...args);
    }
  }

  #getChild() {
    if (!this.#child) {
      throw new Error("The isolated-batch worker was used before it started.");
    }
    return this.#child;
  }
}

export { IsolatedBatchForksWorker as IsolatedBatchThreadsWorker };

export default {
  name: "atlas-isolated-batch",
  createPoolWorker(options) {
    return new IsolatedBatchForksWorker(options);
  },
};
