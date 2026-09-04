import { describe, expect, it } from "vitest";
import vitestConfig from "../vitest.config";

/**
 * Pins the property that keeps a background-agent worktree out of this repo's unit bar.
 *
 * An agent worktree is created at `.claude/worktrees/<name>/` INSIDE the repo and is hidden
 * from git by `.git/info/exclude` — so `git status` reads clean and run-unit-bar.ps1's
 * dirty-tree refusal passes, while vitest is perfectly happy to glob the sibling checkout's
 * `src/` and run its suite as part of THIS repo's bar. That happened in atlas-pms-landing on
 * 2026-09-02 (19 files/111 tests became 38/222, and the count moved between runs as the
 * sibling committed); atlas-sales-portal was the same and both needed a `test.exclude`.
 *
 * This repo needs no such exclude, because every project declares an explicit `include` built
 * by `readdirSync` over fixed scan roots — `.claude` is unreachable by construction. Verified
 * 2026-09-02 by planting a failing probe at `.claude/worktrees/__probe__/probe.test.ts` and
 * running `vitest list`: the probe was not collected and the listing held zero `.claude` paths.
 *
 * But that safety is INCIDENTAL — those include lists exist for batching and pool isolation,
 * not for this. Drop or forget an `include` on any project and vitest silently falls back to
 * its default globs — every test file anywhere under the repo root — the sibling worktree comes
 * back into the run, and nothing
 * else would catch it: the bar's count floor cannot see inflation, and `git status` stays
 * clean. Hence this ratchet, which makes the property intentional rather than lucky.
 */
type ProjectLike = { test?: { name?: string; include?: unknown } };
const config = vitestConfig as unknown as {
  test?: { include?: unknown; projects?: ProjectLike[] };
};

describe("vitest projects pin the collected set (nested agent worktrees)", () => {
  const projects = config.test?.projects ?? [];

  it("declares at least one project", () => {
    expect(Array.isArray(config.test?.projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });

  it("gives EVERY project an explicit include — an absent one falls back to default globs", () => {
    // An empty array is fine: it collects nothing. `undefined` is the dangerous value, because
    // vitest then applies its default test globs from the repo root, which reach .claude.
    for (const project of projects) {
      const name = project.test?.name ?? "(unnamed)";
      expect(Array.isArray(project.test?.include), `project "${name}" has no explicit include`).toBe(
        true,
      );
    }
  });

  it("never collects anything under .claude", () => {
    const offenders = projects.flatMap((project) => {
      const include = Array.isArray(project.test?.include) ? (project.test?.include as unknown[]) : [];
      return include
        .filter((entry): entry is string => typeof entry === "string")
        .filter((entry) => entry.includes(".claude"))
        .map((entry) => `${project.test?.name ?? "(unnamed)"}: ${entry}`);
    });
    expect(offenders).toEqual([]);
  });
});
