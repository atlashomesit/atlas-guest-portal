import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { readdirSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// isolate:false partition (2026-07-07) — ported from atlas-admin-portal
// vitest.config.ts (commit 736550a7).
//
// Baseline on win32 (maxWorkers 1, isolate:true): 204.8s, of which environment
// setup was 111s, import 40s, setup 13s and the tests themselves 12.9s — the
// suite spends ~80% of its wall clock tearing down and recreating per-file
// environments inside the contended release-gate parallel window.
//
// Flipping isolate:false suite-wide is NOT safe in Vitest 4: with a shared
// module registry, a module that an earlier test file in the same worker
// already evaluated for real (or any transitive importer of it) is served from
// cache, so a later file's vi.mock() silently does not apply — failures are
// nondeterministic, varying with file-to-worker scheduling. Per-file
// vi.resetModules() fixes the mocks but nukes the shared cache and is slower
// than isolation.
//
// So the suite is split into two projects on the exact fragility boundary:
//   - "mocked-isolated": files calling vi.mock/vi.doMock run with isolation.
//   - "shared-fast":     everything else shares workers (isolate:false).
// The partition is computed here at config-load time by scanning file
// contents, so a new test that adds vi.mock is routed to the isolated project
// automatically. Cross-file DOM leakage under the shared registry is handled
// by src/test/setup.ts (global afterEach(cleanup) — testing-library's built-in
// auto-cleanup registers only once per worker when modules are shared; the
// setup file itself re-executes per test file, which also re-arms the fetch /
// matchMedia / runtime-config stubs between files).
// ---------------------------------------------------------------------------

// Heavy route smokes: full App / lazy imports exhaust Vitest worker heap on
// Windows and can stall the suite; run explicitly (`npx vitest run <file>`) or
// cover via Playwright. Filtered out of the computed include lists below (and
// kept in `exclude` as belt-and-braces).
const heavyRouteSmokes = [
  "tests/propertyDetailsRouteSmoke.test.tsx",
  "tests/PropertyDetailsMedia.test.tsx",
  "src/App.a11y.test.tsx",
];

const exclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/cypress/**",
  "**/.{idea,git,cache,output,temp}/**",
  "**/*-preview-*/**",
  "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
  ...heavyRouteSmokes,
];

// Scan roots: src/, tests/, functions/ and eslint-rules/. A test file added under a NEW
// top-level directory must be added here or vitest will not see it (the old config used
// vitest's default include, which scanned everything).
//
// functions/ and eslint-rules/ were both MISSING from this list until 2026-08-14, and the
// omission was silent in the worst way: a test outside the scan roots does not fail, it
// DISAPPEARS, and the suite keeps reporting a healthy green "N passed".
//   - functions/sitemap.xml.test.ts (6 cases) had never executed once. listingPathSlug and
//     resolveSitemapTenantSlug — i.e. the whole TASK-7430 "never emit /homes/atlas-homes/...
//     on a white-label host" guard — had ZERO coverage anywhere in the repo as a result.
//   - eslint-rules/{no-utc-today,require-error-before-empty-state}.test.cjs (25 cases) were
//     wired to no runner at all: absent from package.json scripts and from every workflow,
//     and no-utc-today's documented `npx mocha` command could not have worked because mocha
//     is not a dependency of this repo.
// `npx vitest run <file>` answered "No test files found, exiting with code 1" for all three,
// and neither project's resolved include list held an entry for them.
//
// eslint RuleTester harnesses DO run correctly under this config's jsdom environment and
// src/test/setup.ts — RuleTester binds to vitest's injected describe/it globals. Verified
// here, and atlas-admin-portal has scanned ["src", "eslint-rules"] for eight structurally
// identical .cjs harnesses all along. They keep their `node eslint-rules/<f>.test.cjs`
// header comments, which still work; they are simply no longer the ONLY way these run.
//
// tests/showcaseNoindexHosts.test.ts had to be parked in tests/ to dodge the functions/ gap.
// Anything that must run belongs under a root listed HERE.
// NOTE: enumerated with readdirSync({recursive:true}), NOT fs.globSync. globSync landed in Node 22
// and this repo's .nvmrc does pin 22 — but the release gate runs all five repos under whatever Node
// is active on the machine, and atlas-admin-portal pins 20. Under Node 20 the named import is a hard
// SyntaxError ("does not provide an export named 'globSync'") the moment vite bundles this config,
// taking the whole vitest run — and gate STEP 1 — down before a single test executes. readdirSync's
// recursive option exists on 18.17/20.1+ AND 22, so this config no longer cares which is active.
// Same defect was live in atlas-admin-portal's config; see TASK-7044.
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|cjs|mjs)$/;
const testFiles = ["src", "tests", "functions", "eslint-rules"]
  .flatMap((d) => {
    let entries: unknown[];
    try {
      entries = readdirSync(path.resolve(__dirname, d), { recursive: true });
    } catch {
      return []; // scan root absent — same as globSync matching nothing
    }
    return entries
      .map((f) => `${d}/${String(f).replace(/\\/g, "/")}`)
      .filter((f) => TEST_FILE_RE.test(f));
  })
  .filter((f) => !heavyRouteSmokes.includes(f))
  .sort();
// ---------------------------------------------------------------------------
// TZ-pinned partition (2026-08-15). A THIRD project, scoped to `*.tzeast.test.*`, runs east of
// UTC+05:30 (Asia/Tokyo). It exists because a whole class of date defect is INVISIBLE at or west
// of +05:30, and both zones this suite normally runs in — UTC on CI, Asia/Kolkata on dev
// machines — sit on that accidentally-correct side. A local-midnight calendar cell converted as
// if it were an instant lands on the previous IST day only east of the split, which is how an
// off-by-one availability gate shipped to guests in NPT/BST/ICT/CST/JST/KST/AEST/NZST while every
// test stayed green.
//
// Deliberately NOT a suite-wide TZ pin: pinning globally would put every test on one side of the
// split and freeze exactly this class of bug invisible. (atlas-admin-portal's global pin,
// 70d4449e, addresses an unrelated snapshot-stability problem and is not a precedent here.)
//
// The zone must come from the runner, not the test file: `process.env.TZ = ...` inside a worker
// does NOT change the resolved zone (Node has already cached it by then), so a test that sets it
// itself silently runs in the runner's zone and asserts nothing. Files in this project carry a
// guard case asserting the offset really is east of IST so the pin can never decay unnoticed.
const TZ_EAST_RE = /\.tzeast\.test\.(ts|tsx|js|jsx|cjs|mjs)$/;
const TZ_EAST_ZONE = "Asia/Tokyo"; // +09:00

const usesModuleMocks = new Set(
  testFiles.filter((f) =>
    /\bvi\.(mock|doMock)\(/.test(readFileSync(path.resolve(__dirname, f), "utf8"))
  )
);
const tzEastFiles = testFiles.filter((f) => TZ_EAST_RE.test(f));
const nonTzFiles = testFiles.filter((f) => !TZ_EAST_RE.test(f));
const mockedFiles = nonTzFiles.filter((f) => usesModuleMocks.has(f));
const sharedFiles = nonTzFiles.filter((f) => !usesModuleMocks.has(f));

// Windows: release gate runs API/admin/guest Vitest in parallel — keep 1 worker
// to avoid pool startup timeouts / worker-heap exhaustion (see heavyRouteSmokes
// above); the isolate:false shared registry is where the speedup comes from,
// not parallelism. Set at root and per-project so the cap holds whether or not
// the scheduler pools workers across projects.
const workerCap =
  process.platform === "win32"
    ? { maxWorkers: 1, fileParallelism: false }
    : process.env.CI
      ? { maxWorkers: 2 }
      : {};

const baseTest = {
  environment: "jsdom" as const,
  globals: true,
  setupFiles: ["./src/test/setup.ts"],
  deps: {
    inline: ["react-router", "react-router-dom"],
  },
  testTimeout: 120000, // 2 minutes for heavy property tests
  hookTimeout: 60000,
  // Use threads pool to avoid ESM/CommonJS conflicts with forks (mirrors atlas-admin-portal).
  pool: "threads" as const,
  ...workerCap,
  exclude,
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime.js"),
      "react-router-dom/node_modules/react": path.resolve(__dirname, "node_modules/react"),
      "react-router-dom/node_modules/react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  test: {
    ...workerCap,
    projects: [
      {
        extends: true,
        test: {
          ...baseTest,
          name: "mocked-isolated",
          include: mockedFiles,
          isolate: true,
        },
      },
      {
        extends: true,
        test: {
          ...baseTest,
          name: "shared-fast",
          include: sharedFiles,
          isolate: false,
        },
      },
      // Runs east of +05:30 — see the TZ-pinned partition note above. Isolated because these
      // files use vi.mock, and kept a separate project so the pin covers ONLY them.
      {
        extends: true,
        test: {
          ...baseTest,
          name: "tz-east-of-ist",
          include: tzEastFiles,
          isolate: true,
          // `forks`, not the suite-wide `threads`: the zone must be set BEFORE the runtime
          // resolves it. A forked child process is spawned with this env, so it starts in
          // Asia/Tokyo; with threads the env is assigned after jsdom's VM context already
          // resolved the zone, and the pin silently does nothing.
          pool: "forks" as const,
          env: { TZ: TZ_EAST_ZONE },
        },
      },
    ],
  },
});
