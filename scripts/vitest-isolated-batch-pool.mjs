import { Worker } from "node:worker_threads";
import path from "node:path";

/**
 * Keep Vitest's per-file mock/module reset while reusing one threads worker. On the Windows
 * release-gate host, creating a fresh jsdom thread for every mocked test file dominates the
 * guest suite and competes with the three other STEP 1 jobs. The guest ceiling remains one.
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

class IsolatedBatchThreadsWorker {
  name = "atlas-isolated-batch";
  #entrypoint;
  #execArgv;
  #env;
  #thread;
  #stdout;
  #stderr;

  constructor(options) {
    this.#entrypoint = path.resolve(options.distPath, "workers/threads.js");
    this.#execArgv = options.execArgv;
    this.#env = options.env;
    this.#stdout = options.project.vitest.logger.outputStream;
    this.#stderr = options.project.vitest.logger.errorStream;
  }

  on(event, callback) {
    this.#getThread().on(event, callback);
  }

  off(event, callback) {
    this.#getThread().off(event, callback);
  }

  send(message) {
    this.#getThread().postMessage(forceWorkerFileIsolation(message));
  }

  async start() {
    this.#thread ||= new Worker(this.#entrypoint, {
      env: this.#env,
      execArgv: this.#execArgv,
      stdout: true,
      stderr: true,
    });
    this.#stdout.setMaxListeners(this.#stdout.getMaxListeners() + 1);
    this.#stderr.setMaxListeners(this.#stderr.getMaxListeners() + 1);
    this.#thread.stdout.pipe(this.#stdout);
    this.#thread.stderr.pipe(this.#stderr);
  }

  async stop() {
    const thread = this.#getThread();
    await thread.terminate();
    thread.stdout.unpipe(this.#stdout);
    thread.stderr.unpipe(this.#stderr);
    this.#stdout.setMaxListeners(this.#stdout.getMaxListeners() - 1);
    this.#stderr.setMaxListeners(this.#stderr.getMaxListeners() - 1);
    this.#thread = undefined;
  }

  deserialize(data) {
    return data;
  }

  #getThread() {
    if (!this.#thread) throw new Error("The isolated-batch worker was used before it started.");
    return this.#thread;
  }
}

export default {
  name: "atlas-isolated-batch",
  createPoolWorker(options) {
    return new IsolatedBatchThreadsWorker(options);
  },
};
