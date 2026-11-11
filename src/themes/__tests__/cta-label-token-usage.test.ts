/**
 * TASK-102710: `cta-label-contrast.test.ts` proves every palette's `--text-on-cta` clears AA on
 * `--cta-primary`, but that only helps a rule that actually USES the token. Four stylesheet rules
 * painted `var(--cta-primary)` and still forced a literal white label, so the gold-CTA palettes
 * (`private-island-noir`, `emerald-dynasty`: white on #c29b2f = 2.62:1) rendered unreadable
 * buttons. This scans every stylesheet for that pairing so a new copy fails CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : cssFiles(full);
    return name.endsWith(".css") ? [full] : [];
  });

const CTA_FILL = /background(?:-color)?\s*:\s*var\(\s*--cta-primary/;
const LITERAL_WHITE_LABEL = /(?:^|[;{\s])color\s*:\s*(?:#fff\b|#ffffff\b|white\b)/i;

describe("CTA label token usage (TASK-102710)", () => {
  it("no rule fills with --cta-primary and forces a literal white label", () => {
    const offenders: string[] = [];
    for (const file of cssFiles(SRC)) {
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (CTA_FILL.test(body) && LITERAL_WHITE_LABEL.test(body)) {
          offenders.push(`${relative(SRC, file)}: ${selector.trim().split("\n").pop()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
