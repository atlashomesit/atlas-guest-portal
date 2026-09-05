#!/usr/bin/env node
/**
 * TASK-10134: `public/.well-known/atlas-runtime-config.json` is a tracked static asset that ships
 * `apiBaseUrl: "http://127.0.0.1:5120"` for local dev. It must stay tracked -- vite.config.ts's
 * `devRuntimeConfigPlugin` and `resolveBackendTarget()` both read it directly via
 * `fs.readFileSync` to serve `/.well-known/atlas-runtime-config.json` and configure the dev proxy;
 * deleting it breaks `npm run dev` for every developer (see vite.config.ts's own comments).
 *
 * On Cloudflare Pages, `functions/.well-known/atlas-runtime-config.json.ts` is supposed to shadow
 * that static file in every DEPLOYED environment so production/staging get the real API base
 * instead of localhost. Nothing pinned that precedence: remove the Function, or let some future
 * `_routes.json` edit exclude this path from Functions, and production would silently fall back
 * to the static file's localhost apiBaseUrl with no server-side error -- dead on arrival.
 *
 * This script is the pin. It fails (non-zero exit) unless:
 *   (a) the Function file exists and still exports onRequestGet, and
 *   (b) public/_routes.json exists and its most-specific matching rule for
 *       /.well-known/atlas-runtime-config.json is an "include", never an "exclude" -- i.e.
 *       Cloudflare Pages is guaranteed to always route this path through the Function, never
 *       straight to the static asset.
 *
 * The check logic is exported (not just run as a CLI) so tests/pagesRoutesPrecedence.test.ts can
 * exercise it directly against this repo's own real files: a fixture a test invents for itself
 * can never go red when the real files regress, which defeats the point of a regression test.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const TARGET_PATH = "/.well-known/atlas-runtime-config.json";
export const FUNCTION_REL_PATH = "functions/.well-known/atlas-runtime-config.json.ts";
export const ROUTES_REL_PATH = "public/_routes.json";

/**
 * Cloudflare Pages `_routes.json` patterns only ever wildcard at the very end (e.g. `/foo/*`) --
 * see https://developers.cloudflare.com/pages/functions/routing/#_routesjson. That is the only
 * wildcard form this matcher needs to understand.
 */
function ruleMatches(pattern, targetPath) {
  if (typeof pattern !== "string") return false;
  if (pattern === targetPath) return true;
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1); // keep the trailing slash, drop the '*'
    return targetPath.startsWith(prefix);
  }
  return false;
}

/**
 * Cloudflare resolves a conflicting include/exclude by letting the MOST SPECIFIC rule win. An
 * exact match is always more specific than any wildcard; among wildcards, a longer pattern is
 * more specific (`/.well-known/*` beats `/*`). Returns -1 when nothing in `patterns` matches.
 */
function bestSpecificity(patterns, targetPath) {
  let best = -1;
  for (const pattern of patterns ?? []) {
    if (!ruleMatches(pattern, targetPath)) continue;
    const specificity = pattern === targetPath ? Number.POSITIVE_INFINITY : pattern.length;
    if (specificity > best) best = specificity;
  }
  return best;
}

/**
 * @param {string} [root] repo root to check (defaults to this repo) — overridable so tests can
 *   point this at a throwaway fixture directory without touching real files.
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function verifyWellKnownConfigPrecedence(root = ROOT) {
  const problems = [];

  const fnPath = path.join(root, FUNCTION_REL_PATH);
  let fnSource = null;
  try {
    fnSource = readFileSync(fnPath, "utf8");
  } catch {
    problems.push(
      `Function file missing: ${FUNCTION_REL_PATH} -- the static localhost fallback in public/.well-known/ would be served directly.`,
    );
  }
  if (fnSource !== null && !/export\s+(const|function|async\s+function)\s+onRequestGet\b/.test(fnSource)) {
    problems.push(
      `${FUNCTION_REL_PATH} no longer exports onRequestGet -- Cloudflare Pages would not invoke it for this path.`,
    );
  }

  const routesPath = path.join(root, ROUTES_REL_PATH);
  let routes = null;
  try {
    routes = JSON.parse(readFileSync(routesPath, "utf8"));
  } catch (err) {
    problems.push(
      `${ROUTES_REL_PATH} is missing or not valid JSON (${err instanceof Error ? err.message : String(err)}) -- nothing pins the Function ahead of the static asset.`,
    );
  }

  if (routes) {
    const includeSpecificity = bestSpecificity(routes.include, TARGET_PATH);
    const excludeSpecificity = bestSpecificity(routes.exclude, TARGET_PATH);
    if (includeSpecificity === -1) {
      problems.push(
        `${ROUTES_REL_PATH}: no "include" rule matches ${TARGET_PATH} -- the Function would never run for it.`,
      );
    } else if (excludeSpecificity >= includeSpecificity) {
      problems.push(
        `${ROUTES_REL_PATH}: an "exclude" rule matches ${TARGET_PATH} at least as specifically as its "include" rule -- the static localhost fallback could shadow the Function.`,
      );
    }
  }

  return { ok: problems.length === 0, problems };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { ok, problems } = verifyWellKnownConfigPrecedence();
  if (!ok) {
    console.error("[FAIL] verify-well-known-config-precedence:");
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      "\nProduction must never be able to fall back to the static /.well-known/atlas-runtime-config.json " +
        "(its committed apiBaseUrl is http://127.0.0.1:5120, for local dev only). Fix " +
        "functions/.well-known/atlas-runtime-config.json.ts and/or public/_routes.json.",
    );
    process.exit(1);
  }
  console.log("verify-well-known-config-precedence: OK");
}
