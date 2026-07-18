/**
 * TASK-4951 (P1) — the shared Footer "GST Verified" badge was hardcoded to Tailwind's
 * `emerald-400` (#34d399), a decorative/dark-surface accent never audited for text use on
 * light backgrounds. It read as unreadable (<4.5:1 WCAG AA) against 7 of the 14 registered
 * color presets' `--footer-bg` — every LIGHT footer preset. Fix (palette-preserving, same
 * "-text" token pattern as `--accent-text`/`--lavender-text`, TASK-4923 precedent):
 *
 *   - `base.css` now defines `--support-success-text` (default #065f46, tuned against the
 *     LIGHT footer group — the binding constraint).
 *   - The 7 DARK-footer presets (default, privateIslandNoir, ultraYachtAzure, emeraldDynasty,
 *     valentine, christmas, newYear) override it back to the original bright #34d399, which
 *     already read fine there.
 *   - `Footer.tsx`'s badge now binds to `var(--support-success-text)` instead of the
 *     hardcoded Tailwind class.
 *   - `sunriseCoral`'s `--footer-link` (measured 4.37:1 against its `--footer-bg` #FFF0E6)
 *     was darkened from `rgba(122, 79, 53, 0.9)` to `rgba(100, 60, 38, 0.9)`.
 *
 * This test reads the actual token values out of the real CSS source files (via `fs`, same
 * pattern `ac7-layout-theme-switch.test.tsx` already uses for source-level assertions —
 * Vite CSS imports are stubbed under vitest, so `getComputedStyle` cascade tricks can't see
 * real stylesheet content) and computes contrast with the standard WCAG relative-luminance
 * formula (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) — no ratio is hardcoded,
 * only the source hex/rgba values and the >=4.5:1 AA threshold.
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

/** Alpha-composites an rgba(...) foreground over a solid hex background (standard "over" operator). */
function compositeOver(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];
}

const AA_NORMAL_TEXT_MIN = 4.5;

// ---------------------------------------------------------------------------------------
// Read real token values out of the actual CSS source files
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

/** Parses a `#rrggbb` or `rgba(r, g, b, a)` CSS color literal into an opaque Rgb, resolving alpha over `bg`. */
function resolveColor(value: string, bg: Rgb): Rgb {
  const rgbaMatch = value.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const fg: Rgb = [Number(r), Number(g), Number(b)];
    const alpha = a === undefined ? 1 : Number(a);
    return alpha >= 1 ? fg : compositeOver(fg, alpha, bg);
  }
  if (value.startsWith("#")) {
    return hexToRgb(value);
  }
  throw new Error(`Unsupported color literal: ${value}`);
}

const baseCss = read("base.css");
const defaultCss = read("default.css");
const luxuryCss = read("atlas-luxury-multi-theme.css");
const auroraCss = read("aurora-champagne.css");
const jetsetCss = read("jetset-pearl.css");
const loversCss = read("lovers-retreat-blush.css");
const christmasCss = read("christmas.css");
const emeraldDynastyCss = read("emerald-dynasty.css");
const newYearCss = read("new-year.css");
const privateIslandNoirCss = read("private-island-noir.css");
const ultraYachtAzureCss = read("ultra-yacht-azure.css");
const valentineCss = read("valentine.css");

/** `sunriseCoral`/`oceanLuxury`/`royalViolet`/`emeraldOasis` alias `--footer-bg` to `--bg-section-alt` — resolve it from the same preset block. */
function extractPresetBlock(source: string, dataTheme: string): string {
  const start = source.indexOf(`:root[data-theme="${dataTheme}"]`);
  if (start === -1) throw new Error(`Preset block for ${dataTheme} not found`);
  const end = source.indexOf("\n}", start);
  return source.slice(start, end);
}

const sunriseCoralBlock = extractPresetBlock(luxuryCss, "sunriseCoral");
const oceanLuxuryBlock = extractPresetBlock(luxuryCss, "oceanLuxury");
const royalVioletBlock = extractPresetBlock(luxuryCss, "royalViolet");
const emeraldOasisBlock = extractPresetBlock(luxuryCss, "emeraldOasis");

// The 14 registered color presets' `--footer-bg`, all confirmed light or dark per TASK-4951.
const LIGHT_FOOTER_BG: Record<string, string> = {
  jetsetPearl: hexColor(extractToken(jetsetCss, "--footer-bg")),
  loversRetreatBlush: hexColor(extractToken(loversCss, "--footer-bg")),
  auroraChampagne: hexColor(extractToken(auroraCss, "--footer-bg")),
  sunriseCoral: hexColor(extractToken(sunriseCoralBlock, "--bg-section-alt")),
  oceanLuxury: hexColor(extractToken(oceanLuxuryBlock, "--bg-section-alt")),
  royalViolet: hexColor(extractToken(royalVioletBlock, "--bg-section-alt")),
  emeraldOasis: hexColor(extractToken(emeraldOasisBlock, "--bg-section-alt")),
};

const DARK_FOOTER_BG: Record<string, string> = {
  default: hexColor(extractToken(defaultCss, "--footer-bg")),
  privateIslandNoir: hexColor(extractToken(privateIslandNoirCss, "--footer-bg")),
  ultraYachtAzure: hexColor(extractToken(ultraYachtAzureCss, "--footer-bg")),
  emeraldDynasty: hexColor(extractToken(emeraldDynastyCss, "--footer-bg")),
  valentine: hexColor(extractToken(valentineCss, "--footer-bg")),
  christmas: hexColor(extractToken(christmasCss, "--footer-bg")),
  newYear: hexColor(extractToken(newYearCss, "--footer-bg")),
};

function hexColor(value: string): string {
  if (!value.startsWith("#")) {
    throw new Error(`Expected a solid hex --footer-bg literal, got: ${value}`);
  }
  return value;
}

describe("TASK-4951 — --support-success-text vs every registered --footer-bg (WCAG AA)", () => {
  it("declares exactly 7 light + 7 dark registered footer backgrounds (sanity guard)", () => {
    expect(Object.keys(LIGHT_FOOTER_BG)).toHaveLength(7);
    expect(Object.keys(DARK_FOOTER_BG)).toHaveLength(7);
  });

  const baseSuccessText = extractToken(baseCss, "--support-success-text");

  it.each(Object.entries(LIGHT_FOOTER_BG))(
    "base.css default --support-success-text (%s footer-bg) clears AA",
    (_name, bgHex) => {
      const bg = hexToRgb(bgHex);
      const fg = resolveColor(baseSuccessText, bg);
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
    },
  );

  const darkPresetSources: Record<string, string> = {
    default: defaultCss,
    privateIslandNoir: privateIslandNoirCss,
    ultraYachtAzure: ultraYachtAzureCss,
    emeraldDynasty: emeraldDynastyCss,
    valentine: valentineCss,
    christmas: christmasCss,
    newYear: newYearCss,
  };

  it.each(Object.entries(DARK_FOOTER_BG))(
    "%s preset's own --support-success-text override clears AA against its --footer-bg",
    (name, bgHex) => {
      const source = darkPresetSources[name];
      const overrideValue = extractToken(source, "--support-success-text");
      const bg = hexToRgb(bgHex);
      const fg = resolveColor(overrideValue, bg);
      const ratio = contrastRatio(fg, bg);
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
    },
  );

  it("every dark preset's override literal is bright enough to differ from the light-tuned default", () => {
    // Guards against a future edit accidentally deleting an override and silently falling
    // back to base.css's light-tuned (dark-green) default, which would fail on a dark footer.
    for (const [name, source] of Object.entries(darkPresetSources)) {
      const overrideValue = extractToken(source, "--support-success-text");
      expect(overrideValue, `${name} should override --support-success-text`).not.toBe(baseSuccessText);
    }
  });
});

describe("TASK-4951 — sunriseCoral --footer-link vs --footer-bg (WCAG AA)", () => {
  it("clears >=4.5:1 (was measured 4.37:1 before the fix)", () => {
    const bgHex = hexColor(extractToken(sunriseCoralBlock, "--bg-section-alt"));
    const bg = hexToRgb(bgHex);
    const linkValue = extractToken(sunriseCoralBlock, "--footer-link");
    const fg = resolveColor(linkValue, bg);
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
  });
});

describe("TASK-4951 — Footer.tsx no longer hardcodes emerald-400", () => {
  it("does not reference text-emerald-400 or border-emerald-400/40", () => {
    const footerSource = readFileSync(
      resolve(__dirname, "../../../components/commonComponents/footer/Footer.tsx"),
      "utf-8",
    );
    expect(footerSource).not.toMatch(/text-emerald-400/);
    expect(footerSource).not.toMatch(/border-emerald-400\/40/);
    expect(footerSource).toContain("--support-success-text");
  });
});
