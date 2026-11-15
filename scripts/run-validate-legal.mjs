import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stampPath = path.join(root, "node_modules", ".cache", "validate-legal.stamp");
const STAMP_TTL_MS = 15 * 60 * 1000;

function computeLegalInputHash() {
  const hash = createHash("sha256");
  const legalDir = path.join(root, "src", "content", "legal");
  if (existsSync(legalDir)) {
    const entries = readdirSync(legalDir, { recursive: true })
      .map((entry) => `src/content/legal/${String(entry).replace(/\\/g, "/")}`)
      .sort();
    for (const rel of entries) {
      const abs = path.join(root, rel);
      try {
        const content = readFileSync(abs);
        hash.update(`file:${rel}\0`);
        hash.update(content);
        hash.update("\0");
      } catch {
        // Ignore directory entries returned by recursive readdirSync.
      }
    }
  }
  for (const rel of ["package.json", "vitest.legal.config.ts"]) {
    const abs = path.join(root, rel);
    hash.update(`root:${rel}\0`);
    hash.update(readFileSync(abs));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function getCleanGitHead() {
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!/^[0-9a-f]{40}$/i.test(head)) return null;
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (status.trim().length > 0) return null;
    return head.toLowerCase();
  } catch {
    return null;
  }
}

const forceRun =
  process.env.ATLAS_FORCE_VALIDATE_LEGAL === "1" || process.argv.includes("--force");
const cleanHead = getCleanGitHead();
const inputHash = computeLegalInputHash();

if (!forceRun && cleanHead) {
  try {
    const raw = JSON.parse(readFileSync(stampPath, "utf8"));
    const ageMs = Date.now() - Number(raw?.timestampMs);
    if (
      raw?.head === cleanHead &&
      raw?.inputHash === inputHash &&
      Number.isFinite(ageMs) &&
      ageMs >= 0 &&
      ageMs <= STAMP_TTL_MS
    ) {
      console.log(
        `[validate:legal] Reusing fresh clean-HEAD stamp (${cleanHead.slice(0, 8)}, ${(ageMs / 1000).toFixed(1)}s old).`,
      );
      process.exit(0);
    }
  } catch {
    // Missing or unreadable stamp -> run Vitest below.
  }
}

const child = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.legal.config.ts", "--bail=1"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CI: "1" },
  },
);

if (child.status !== 0) {
  rmSync(stampPath, { force: true });
  process.exit(child.status ?? 1);
}

const cleanHeadAfter = getCleanGitHead();
if (cleanHeadAfter && cleanHeadAfter === cleanHead) {
  mkdirSync(path.dirname(stampPath), { recursive: true });
  writeFileSync(
    stampPath,
    `${JSON.stringify({ head: cleanHeadAfter, inputHash, timestampMs: Date.now() })}\n`,
    "utf8",
  );
} else {
  rmSync(stampPath, { force: true });
}
