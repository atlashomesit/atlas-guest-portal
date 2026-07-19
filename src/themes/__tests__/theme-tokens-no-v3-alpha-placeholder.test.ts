/**
 * TASK-4949 regression test.
 *
 * `src/index.css`'s `@theme` block used to define six `--color-*` entries with Tailwind
 * v3's `<alpha-value>` placeholder syntax (`rgb(var(--*-rgb) / <alpha-value>)`). Tailwind v4's
 * `@theme` does not substitute that placeholder — the literal string survives into the served
 * CSS, the declaration is invalid, and `background-color: var(--color-cta-primary)` (etc.)
 * resolves to nothing, silently rendering the element transparent. `bg-cta-primary`,
 * `bg-cta-primary-hover`, `bg-cta-secondary`, `bg-accent-primary`, `bg-accent-soft`, and
 * `bg-primary` were all affected.
 *
 * jsdom does not run Tailwind's build pipeline, so this test cannot assert on a resolved
 * `getComputedStyle` background — instead it reads the actual CSS source (the same file
 * Tailwind's build consumes) and asserts no `--color-*` declaration in the `@theme` block
 * carries the invalid v3 placeholder, and that every `-rgb`-backed color token uses the v4-valid
 * `rgb(var(--*-rgb))` form so Tailwind's own opacity-modifier machinery (`bg-primary/10`, via
 * `color-mix`) keeps working.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_CSS_PATH = resolve(HERE, "../../index.css");

const readThemeBlock = (): string => {
  const css = readFileSync(INDEX_CSS_PATH, "utf8");
  const match = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
  if (!match) {
    throw new Error("Could not locate the @theme block in src/index.css");
  }
  return match[1];
};

describe("src/index.css @theme block — no Tailwind v3 <alpha-value> placeholder (TASK-4949)", () => {
  it("contains no literal <alpha-value> anywhere in the @theme block", () => {
    const themeBlock = readThemeBlock();
    expect(themeBlock).not.toMatch(/<alpha-value>/);
  });

  it("defines every -rgb-backed color token in the valid v4 rgb(var(--*-rgb)) form", () => {
    const themeBlock = readThemeBlock();
    const rgbBackedTokens = [
      "--color-accent-primary",
      "--color-accent-soft",
      "--color-cta-primary",
      "--color-cta-primary-hover",
      "--color-cta-secondary",
      "--color-primary",
    ];

    for (const token of rgbBackedTokens) {
      const re = new RegExp(`${token}\\s*:\\s*([^;]+);`);
      const declMatch = themeBlock.match(re);
      expect(declMatch, `expected ${token} to be declared in the @theme block`).not.toBeNull();
      const value = declMatch![1].trim();
      expect(
        value,
        `${token}: "${value}" is not the valid Tailwind v4 form rgb(var(--*-rgb))`,
      ).toMatch(/^rgb\(var\(--[\w-]+-rgb\)\)$/);
    }
  });
});
