#!/usr/bin/env node
/**
 * Smoke test: build + preview, then fetch property routes and assert they don't show
 * the error-boundary fallback ("We couldn't load this page").
 * Run: npm run build && node scripts/smoke-preview-routes.mjs
 */
import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const ROUTES = [
  "/homes/atlas-homes-room-202/4",
  "/homes/atlas-homes-room-301/5",
  "/homes/atlas-homes-room-102/2",
];

const PREVIEW_PORT = 4173;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function main() {
  const child = spawn("npx", ["vite", "preview", "--port", String(PREVIEW_PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  const ready = await waitForServer(BASE);
  if (!ready) {
    console.error("Preview server did not start in time");
    child.kill();
    process.exit(1);
  }

  let failed = false;
  for (const path of ROUTES) {
    try {
      const res = await fetch(BASE + path);
      const html = await res.text();
      if (res.status !== 200) {
        console.error(`[FAIL] ${path} status=${res.status}`);
        failed = true;
      } else if (html.includes("We couldn't load this page")) {
        console.error(`[FAIL] ${path} shows error-boundary fallback`);
        failed = true;
      } else if (html.includes("₹0") && html.includes("Best price")) {
        console.error(`[FAIL] ${path} shows ₹0 pricing`);
        failed = true;
      } else {
        console.log(`[OK] ${path}`);
      }
    } catch (e) {
      console.error(`[FAIL] ${path}`, e.message);
      failed = true;
    }
  }

  child.kill();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
