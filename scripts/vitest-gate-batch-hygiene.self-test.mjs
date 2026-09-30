import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guard for TASK-102734 cause C: state that crosses test files on the gate's REUSED batch thread.
 *
 * Runs src/test/fixtures/gate-batch-hygiene/ through vitest.gate-batch-hygiene.config.ts, which is the production
 * `mocked-isolated` project (ATLAS_VITEST_GATE_BATCH=1: batch pool, one thread, same setup files) pinned to run the
 * "dirty" fixture and then the "clean" fixture on one thread. The clean fixture fails if anything the dirty one left
 * (URL, storage, cookies, head/body, window stubs, queued vi.mock, in-flight import, ...) is still visible, so a
 * regression in src/test/sharedWorkerHygiene.ts, in the setup-file order, or in how the batch pool isolates files
 * turns `npm run test:gate` red HERE, deterministically, instead of as a random victim file later in STEP 1.
 *
 * Default (what test:gate runs): the pair must pass.
 * --negative-control: the same pair with the reset removed must FAIL on every deterministic case. Proves the fixtures
 * can go red; run it after touching the fixtures (`npm run test:gate:hygiene-negative-control`). Not part of test:gate:
 * its last case is a race by construction when there is no drain, and a guard must not add a flake of its own.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const negativeControl = process.argv.includes("--negative-control");
const outDir = path.join(root, "node_modules", ".cache", "atlas-gate-batch-hygiene");

/** Test titles that must go red when the reset is removed. The stale-import case is race-dependent there, so it is not required. */
const DETERMINISTIC_CASES = [
  "the jsdom URL and window.location are back to the worker's starting state",
  "web storage and cookies are empty",
  "document title, head and body carry nothing over",
  "html and body attributes carry nothing over",
  "document.visibilityState is visible again",
  "SDK globals and replaced window properties are re-armed",
  "vi.stubGlobal, vi.stubEnv and fake timers are undone",
  "a vi.doMock queued at the end of the previous file does not apply to this file",
];

function runFixtures(label, extraEnv) {
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${label}-${process.pid}.json`);
  rmSync(outFile, { force: true });
  const child = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.gate-batch-hygiene.config.ts", "--reporter=json", `--outputFile=${outFile}`],
    { cwd: root, encoding: "utf8", env: { ...process.env, ATLAS_VITEST_GATE_BATCH: "1", ...extraEnv }, maxBuffer: 1 << 26 },
  );
  let report;
  try {
    report = JSON.parse(readFileSync(outFile, "utf8"));
  } catch (error) {
    throw new Error(
      `${label}: vitest produced no report (exit ${child.status}).\n${String(child.stderr).slice(-2000)}\n${String(child.stdout).slice(-2000)}`,
      { cause: error },
    );
  } finally {
    rmSync(outFile, { force: true });
  }
  const files = report.testResults.map((f) => ({
    name: f.name.replace(/\\/g, "/").split("/").pop(),
    cases: f.assertionResults.map((a) => ({ title: a.title, status: a.status, message: (a.failureMessages ?? [])[0] ?? "" })),
    fileMessage: f.message ?? "",
  }));
  return { status: child.status, files, stderr: String(child.stderr) };
}

function describeFailures(run) {
  return run.files
    .flatMap((f) => [
      ...(f.fileMessage ? [`${f.name}: ${f.fileMessage.split("\n")[0]}`] : []),
      ...f.cases.filter((c) => c.status !== "passed").map((c) => `${f.name} > ${c.title}: ${c.message.split("\n")[0]}`),
    ])
    .join("\n  ");
}

function assertShape(run) {
  assert.equal(run.files.length, 2, `expected exactly the 2 hygiene fixtures, got ${run.files.map((f) => f.name).join(", ") || "none"}`);
  assert.match(run.files[0].name, /1-dirty\.fixture\.ts$/, "fixture 1 (dirty) must run first");
  assert.match(run.files[1].name, /2-clean\.fixture\.ts$/, "fixture 2 (clean) must run second");
  assert.equal(run.files[0].cases.length, 1, "the dirty fixture must have run its one case");
}

if (!negativeControl) {
  const run = runFixtures("with-reset", {});
  assertShape(run);
  assert.equal(
    run.status,
    0,
    `gate-batch hygiene FAILED: the reused batch thread leaks state from one test file into the next.\n  ${describeFailures(run)}\n` +
      "See src/test/sharedWorkerHygiene.ts and docs/testing/waitfor-audit-2026-09-30.md section 2.4.",
  );
  const passed = run.files.flatMap((f) => f.cases).filter((c) => c.status === "passed").length;
  console.log(`PASS vitest gate-batch hygiene guard (dirty -> clean on one reused batch thread, ${passed} cases)`);
} else {
  const run = runFixtures("no-reset", { ATLAS_HYGIENE_SELFTEST_NO_RESET: "1" });
  assertShape(run);
  assert.notEqual(run.status, 0, "negative control: with the reset removed the clean fixture must FAIL, but it passed (the guard is blind)");
  const clean = run.files[1];
  const failed = new Set(clean.cases.filter((c) => c.status === "failed").map((c) => c.title));
  const stillGreen = DETERMINISTIC_CASES.filter((title) => !failed.has(title));
  assert.deepEqual(stillGreen, [], `negative control: these cases stayed green without the reset (the guard cannot catch them):\n  ${stillGreen.join("\n  ")}`);
  const raced = clean.cases.find((c) => /in flight/.test(c.title));
  console.log(
    `PASS negative control: without the reset ${failed.size} of ${clean.cases.length} clean-fixture cases go red ` +
      `(${DETERMINISTIC_CASES.length} deterministic ones all red; stale-import case: ${raced?.status ?? "n/a"})`,
  );
}
