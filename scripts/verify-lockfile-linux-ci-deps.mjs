#!/usr/bin/env node
/**
 * Ensures package-lock.json lists Linux x64 native packages that Cloudflare Pages
 * needs after `npm ci`. Locks generated on Windows often omit nested optional-deps
 * entries, so Rollup/Vitest and sharp fail on linux-x64 even though local build works.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const pkgs = lock.packages ?? {};

const required = [
  "node_modules/@rollup/rollup-linux-x64-gnu",
  "node_modules/@img/sharp-linux-x64",
  "node_modules/@img/sharp-libvips-linux-x64",
];

const missing = required.filter((k) => !pkgs[k]);
if (missing.length) {
  console.error("package-lock.json is missing Linux CI package entries (Cloudflare npm ci will break):");
  for (const m of missing) console.error(`  - ${m}`);
  console.error(
    "Add matching versions as root optionalDependencies in package.json, then run npm install and commit package-lock.json."
  );
  process.exit(1);
}

console.log("Lockfile Linux CI native deps: OK");
