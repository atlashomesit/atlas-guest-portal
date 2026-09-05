/**
 * TASK-10134: `public/.well-known/atlas-runtime-config.json` is a tracked static asset shipping
 * `apiBaseUrl: "http://127.0.0.1:5120"` (local dev only — vite.config.ts's devRuntimeConfigPlugin
 * and resolveBackendTarget() both depend on this file existing, so it cannot simply be deleted).
 * The Cloudflare Pages Function at functions/.well-known/atlas-runtime-config.json.ts is supposed
 * to shadow it in every deployed environment, but nothing pinned that precedence — remove the
 * Function, or let some future public/_routes.json edit exclude this path from Functions, and
 * production would silently serve the static localhost apiBaseUrl with no server-side error.
 *
 * The first test below exercises scripts/verify-well-known-config-precedence.mjs against THIS
 * repo's own real files. A fixture this file invented itself could never go red when the real
 * files regress, which would prove nothing — see that script's module docstring for the full
 * rationale and the matching rules it encodes.
 *
 * The second test pins the matcher's own detection logic against synthetic fixtures, so the
 * "proof" above isn't just "the checker always returns ok" — it demonstrates the checker CAN fail
 * when a routes config would actually let the static asset shadow the Function.
 *
 * Lives under tests/ (not scripts/) for the same reason tests/runtimeConfigTenantKey.test.ts does:
 * vitest.config.ts's scan roots are ["src", "tests", "functions", "eslint-rules"] — scripts/ is not
 * among them, so a test file placed there would silently never run.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FUNCTION_REL_PATH,
  ROUTES_REL_PATH,
  verifyWellKnownConfigPrecedence,
} from "../scripts/verify-well-known-config-precedence.mjs";

const VALID_FUNCTION_SOURCE = `export const onRequestGet = async () => new Response("{}");\n`;

describe("atlas-runtime-config.json Function precedence (Cloudflare Pages)", () => {
  it("is pinned in this repo's real files so production can never fall back to the static localhost config", () => {
    const result = verifyWellKnownConfigPrecedence();
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  describe("detection logic (synthetic fixtures — proves the checker can actually fail)", () => {
    let fixtureRoot: string;

    afterEach(() => {
      if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
    });

    function makeFixture({
      withFunction = true,
      functionSource = VALID_FUNCTION_SOURCE,
      routes,
    }: {
      withFunction?: boolean;
      functionSource?: string;
      routes?: unknown;
    }) {
      fixtureRoot = mkdtempSync(path.join(tmpdir(), "atlas-routes-precedence-"));
      if (withFunction) {
        const fnPath = path.join(fixtureRoot, FUNCTION_REL_PATH);
        mkdirSync(path.dirname(fnPath), { recursive: true });
        writeFileSync(fnPath, functionSource, "utf8");
      }
      if (routes !== undefined) {
        const routesPath = path.join(fixtureRoot, ROUTES_REL_PATH);
        mkdirSync(path.dirname(routesPath), { recursive: true });
        writeFileSync(routesPath, JSON.stringify(routes), "utf8");
      }
      return fixtureRoot;
    }

    it("passes a routes config that pins the default Functions-first behaviour", () => {
      const root = makeFixture({ routes: { version: 1, include: ["/*"], exclude: [] } });
      expect(verifyWellKnownConfigPrecedence(root)).toEqual({ ok: true, problems: [] });
    });

    it("fails when an exclude rule matches the well-known config path", () => {
      const root = makeFixture({
        routes: { version: 1, include: ["/*"], exclude: ["/.well-known/*"] },
      });
      const result = verifyWellKnownConfigPrecedence(root);
      expect(result.ok).toBe(false);
      expect(result.problems.some((p) => p.includes("exclude"))).toBe(true);
    });

    it("fails when the literal path is excluded even if a broader include also matches", () => {
      const root = makeFixture({
        routes: {
          version: 1,
          include: ["/*"],
          exclude: ["/.well-known/atlas-runtime-config.json"],
        },
      });
      expect(verifyWellKnownConfigPrecedence(root).ok).toBe(false);
    });

    it("fails when no include rule reaches the path at all", () => {
      const root = makeFixture({ routes: { version: 1, include: ["/api/*"], exclude: [] } });
      const result = verifyWellKnownConfigPrecedence(root);
      expect(result.ok).toBe(false);
      expect(result.problems.some((p) => p.includes("include"))).toBe(true);
    });

    it("fails when public/_routes.json is missing entirely", () => {
      const root = makeFixture({ routes: undefined });
      const result = verifyWellKnownConfigPrecedence(root);
      expect(result.ok).toBe(false);
      expect(result.problems.some((p) => p.includes(ROUTES_REL_PATH))).toBe(true);
    });

    it("fails when the Function file is missing", () => {
      const root = makeFixture({ withFunction: false, routes: { version: 1, include: ["/*"], exclude: [] } });
      const result = verifyWellKnownConfigPrecedence(root);
      expect(result.ok).toBe(false);
      expect(result.problems.some((p) => p.includes(FUNCTION_REL_PATH))).toBe(true);
    });

    it("fails when the Function no longer exports onRequestGet", () => {
      const root = makeFixture({
        functionSource: "export const onRequestPost = async () => new Response();\n",
        routes: { version: 1, include: ["/*"], exclude: [] },
      });
      const result = verifyWellKnownConfigPrecedence(root);
      expect(result.ok).toBe(false);
      expect(result.problems.some((p) => p.includes("onRequestGet"))).toBe(true);
    });
  });
});
