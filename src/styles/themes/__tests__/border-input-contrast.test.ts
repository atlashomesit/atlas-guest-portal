/**
 * TASK-10178 part 2 -- `--border-input` (base.css) must clear WCAG 1.4.11's >=3:1 non-text
 * contrast floor against `--bg-surface`, for EVERY registered preset, not just the default
 * theme the defect was originally measured against.
 *
 * The bug this locks down: EmbedPage.tsx's six form-control borders used `--border-subtle`
 * (default.css: `rgba(59, 31, 30, 0.08)`, 8% of --text-primary), which measures 1.17:1 on
 * white -- nowhere near the 3:1 floor for an interactive control's boundary. Reaching for the
 * "stronger" sibling token doesn't fix it either: `--border-strong` (20% of --text-primary)
 * only measures ~1.49:1. Both stay firmly in "decorative hairline" territory by design --
 * they are consumed ~277 times across ~63 files for cards/dividers/section rules, none of
 * which WCAG 1.4.11 applies to, so darkening either at the token level would restyle every
 * one of those call sites for no compliance benefit AND still not clear 3:1.
 *
 * `--border-input` is a NEW, separate token (base.css), deliberately not a per-theme literal:
 * it is `color-mix(in srgb, var(--text-primary) 55%, var(--bg-surface))`. Every preset already
 * audits its own --text-primary to a much higher bar against its own --bg-surface (normal-text
 * AA, >=4.5:1, typically >=12:1 in this design system -- see the text/bg column this test
 * prints), so mixing it in is guaranteed to move contrast in the right direction whether the
 * preset's surface is light (default, valentine, ...) or dark (emeraldDynasty,
 * privateIslandNoir, ultraYachtAzure) -- with no per-theme override file needed. This test
 * proves that guarantee actually holds for every preset currently registered, the same way
 * `accent-text-preset-contrast.test.ts` proves it for --accent-text/--lavender-text: driven off
 * index.css's own @import list (a newly added preset is covered the moment it is imported,
 * without anyone remembering to register it here), and computed from real source hex values
 * with the WCAG relative-luminance formula -- no ratio is hardcoded, only the 3.0 floor and
 * the color-mix percentage actually declared in base.css.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

type Rgb = [number, number, number];

function srgbChannelToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** `color-mix(in srgb, A p%, B (100-p)%)` -- a plain per-channel blend of raw sRGB byte values
 * (the non-linear space `in srgb` names; NOT linear-light interpolation). Mirrors what the
 * browser actually computes for the declaration under test. */
function mixSrgb(a: Rgb, b: Rgb, percentA: number): Rgb {
  const p = percentA / 100;
  return [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)) as Rgb;
}

const WCAG_UI_COMPONENT_MIN = 3.0;
const THEMES_DIR = resolve(__dirname, "..");

const read = (file: string) => readFileSync(resolve(THEMES_DIR, file), "utf-8");

/** Only files index.css actually imports are live; anything else in the dir is dead weight
 * (see `KNOWN_ORPHANED_THEME_CSS` in accent-text-preset-contrast.test.ts -- luxury-pastel.css). */
const importedFiles = [...read("index.css").matchAll(/@import\s+"\.\/([^"]+)"/g)].map((m) => m[1]);

/** `--token: value;` within an already-isolated block. Anchored so prose in comments can't match. */
function tokenIn(body: string, token: string): string | null {
  const m = body.match(new RegExp(`^\\s*${token}:\\s*([^;]+);`, "m"));
  return m ? m[1].trim() : null;
}

/** Collect every `:root[data-theme="<id>"]` block across the imported files. */
const presets: Record<string, { file: string; body: string }> = {};
for (const file of importedFiles) {
  const source = read(file);
  const re = /:root\[data-theme="([A-Za-z]+)"\]\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const start = m.index + m[0].length;
    const end = source.indexOf("\n}", start);
    presets[m[1]] = { file, body: source.slice(start, end === -1 ? undefined : end) };
  }
}

const baseBody = read("base.css");

/** Resolves a token to a hex literal, falling back to base.css's `:root` default when the
 * preset doesn't define it (every preset currently defines both --text-primary and
 * --bg-surface directly, but the fallback keeps this honest if a future preset omits one). */
function resolveHex(body: string, token: string): string | null {
  const value = tokenIn(body, token) ?? tokenIn(baseBody, token);
  return value && value.startsWith("#") ? value : null;
}

describe("--border-input clears WCAG 1.4.11 (>=3:1) on every preset's own --bg-surface", () => {
  it("index.css imports at least the known preset files, and presets were actually discovered", () => {
    // Guards the discovery mechanism itself: if the @import parse ever silently returns
    // nothing, the describe.each below would vacuously pass with zero cases.
    expect(importedFiles.length).toBeGreaterThan(5);
    expect(Object.keys(presets).length).toBeGreaterThan(10);
  });

  it("base.css declares --border-input as a color-mix of --text-primary into --bg-surface", () => {
    const declaration = tokenIn(baseBody, "--border-input");
    expect(declaration, "--border-input not found in base.css").not.toBeNull();
    expect(declaration).toMatch(/^color-mix\(\s*in\s+srgb\s*,/);
    expect(declaration).toContain("var(--text-primary)");
    expect(declaration).toContain("var(--bg-surface)");
  });

  /** The percentage is read out of the real declaration, not hardcoded, so this test tracks
   * whatever base.css actually ships rather than asserting its own expectation of it. */
  const mixPercent = (() => {
    const declaration = tokenIn(baseBody, "--border-input") ?? "";
    const m = declaration.match(/var\(--text-primary\)\s*(\d+(?:\.\d+)?)%/);
    if (!m) throw new Error(`Could not read the --text-primary mix percentage out of: ${declaration}`);
    return Number(m[1]);
  })();

  describe.each(Object.entries(presets))("%s", (id, { body }) => {
    it(`effective --border-input clears ${WCAG_UI_COMPONENT_MIN}:1 on its own --bg-surface`, () => {
      const textPrimary = resolveHex(body, "--text-primary");
      const bgSurface = resolveHex(body, "--bg-surface");
      expect(textPrimary, `${id} --text-primary did not resolve to a hex literal`).not.toBeNull();
      expect(bgSurface, `${id} --bg-surface did not resolve to a hex literal`).not.toBeNull();

      const mixed = mixSrgb(hexToRgb(textPrimary as string), hexToRgb(bgSurface as string), mixPercent);
      const ratio = contrastRatio(mixed, hexToRgb(bgSurface as string));
      expect(
        ratio,
        `${id}: color-mix(--text-primary ${textPrimary} ${mixPercent}%, --bg-surface ${bgSurface}) on ${bgSurface}`,
      ).toBeGreaterThanOrEqual(WCAG_UI_COMPONENT_MIN);
    });
  });
});
