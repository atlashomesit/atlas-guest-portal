/**
 * TASK-4962 (P1) — `ultra-yacht-azure.css` never overrode `--accent-text`/`--lavender-text`,
 * so both fell back to `base.css`'s light-tuned defaults (`#a84832` / `#6f5aa8`), which
 * measured 3.15:1/2.86:1 (accent-text) and 3.21:1/2.91:1 (lavender-text) against this
 * preset's own `--bg-primary`/`--bg-surface` — failing the 4.5:1 WCAG AA floor on real
 * price chips/badges (`SearchAvailabilityWidget.tsx`, `MarketplaceHomepage.tsx`,
 * `Homepage_LocationDetails.tsx`).
 *
 * Fix (palette-preserving, same "-text" token pattern `emerald-dynasty.css`/
 * `private-island-noir.css` used for TASK-4952): brand-matched overrides added directly to
 * `ultra-yacht-azure.css`.
 *
 * This test reads the real token values out of the actual CSS source files (via `fs`, same
 * pattern `footer-success-text-contrast.test.ts` already uses for source-level assertions —
 * Vite CSS imports are stubbed under vitest) and computes contrast with the standard WCAG
 * relative-luminance formula (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) — no
 * ratio is hardcoded, only the source hex values and the >=4.5:1 AA threshold.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------------------
// WCAG relative-luminance / contrast-ratio helpers
// ---------------------------------------------------------------------------------------

type Rgb = [number, number, number];

function srgbChannelToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const AA_NORMAL_TEXT_MIN = 4.5;

// ---------------------------------------------------------------------------------------
// Read real token values out of the actual CSS source file
// ---------------------------------------------------------------------------------------

const THEMES_DIR = resolve(__dirname, "..");

function read(file: string): string {
  return readFileSync(resolve(THEMES_DIR, file), "utf-8");
}

/** Extracts a single `--token: value;` declaration's raw value from a CSS source string. */
function extractToken(source: string, token: string): string {
  const match = source.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`Token ${token} not found in source`);
  }
  return match[1].trim();
}

function hexColor(value: string): string {
  if (!value.startsWith("#")) {
    throw new Error(`Expected a solid hex color literal, got: ${value}`);
  }
  return value;
}

const baseCss = read("base.css");
const ultraYachtAzureCss = read("ultra-yacht-azure.css");

const baseAccentText = extractToken(baseCss, "--accent-text");
const baseLavenderText = extractToken(baseCss, "--lavender-text");

const overrideAccentText = extractToken(ultraYachtAzureCss, "--accent-text");
const overrideLavenderText = extractToken(ultraYachtAzureCss, "--lavender-text");

const bgPrimary = hexToRgb(hexColor(extractToken(ultraYachtAzureCss, "--bg-primary")));
const bgSurface = hexToRgb(hexColor(extractToken(ultraYachtAzureCss, "--bg-surface")));

describe("TASK-4962 — ultraYachtAzure --accent-text/--lavender-text vs its own surfaces (WCAG AA)", () => {
  it("declares its own --accent-text override (does not fall back to base.css's light-tuned default)", () => {
    expect(overrideAccentText).not.toBe(baseAccentText);
  });

  it("declares its own --lavender-text override (does not fall back to base.css's light-tuned default)", () => {
    expect(overrideLavenderText).not.toBe(baseLavenderText);
  });

  it.each([
    ["--bg-primary", bgPrimary],
    ["--bg-surface", bgSurface],
  ])("--accent-text clears >=4.5:1 against %s", (_name, bg) => {
    const fg = hexToRgb(hexColor(overrideAccentText));
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
  });

  it.each([
    ["--bg-primary", bgPrimary],
    ["--bg-surface", bgSurface],
  ])("--lavender-text clears >=4.5:1 against %s", (_name, bg) => {
    const fg = hexToRgb(hexColor(overrideLavenderText));
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
  });

  it("base.css's light-tuned defaults would have failed AA here (regression guard for the bug this task fixed)", () => {
    const baseFgAccent = hexToRgb(hexColor(baseAccentText));
    const baseFgLavender = hexToRgb(hexColor(baseLavenderText));
    expect(contrastRatio(baseFgAccent, bgPrimary)).toBeLessThan(AA_NORMAL_TEXT_MIN);
    expect(contrastRatio(baseFgAccent, bgSurface)).toBeLessThan(AA_NORMAL_TEXT_MIN);
    expect(contrastRatio(baseFgLavender, bgPrimary)).toBeLessThan(AA_NORMAL_TEXT_MIN);
    expect(contrastRatio(baseFgLavender, bgSurface)).toBeLessThan(AA_NORMAL_TEXT_MIN);
  });
});
