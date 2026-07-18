/**
 * TASK-4923 follow-up — `--text-muted` vs the surfaces the `classic` layout actually
 * renders it on, INCLUDING the ones a preset inherits rather than defines.
 *
 * The bug this locks down: a preset's `--text-muted` was only ever eyeballed against that
 * preset's OWN `--bg-muted` / `--bg-section-alt`. But `classic`'s homepage paints two
 * shared surfaces via `var(--token, <default.css literal>)` fallbacks:
 *
 *   - the why-direct strip  → `var(--bg-secondary, #fdf2e9)`   (cream)
 *   - the host-note panel   → `var(--lavender-soft, #f0eafd)`  (lavender)
 *
 * `--lavender-soft` is defined ONLY in default.css, and `--bg-secondary` only in default.css
 * + the luxury presets — so valentine/christmas (and any future preset that omits them) fall
 * through to those hardcoded literals, i.e. render muted text on a surface their palette never
 * accounted for. Measured in-browser before the fix: sunriseCoral 4.43, oceanLuxury 4.48,
 * emeraldOasis 4.45, newYear 4.41, valentine/christmas 4.05 on the lavender panel, and
 * valentine 3.97 on its own `--bg-muted` #FFE4E9 — all under the 4.5:1 AA floor.
 *
 * Fixes verified here: valentine + christmas `--text-muted` #64748B -> #475569, and the
 * host-note attribution line rebound off `--text-muted` onto `--lavender-text` (which default.css
 * already contrast-validates against the lavender panel at 4.83:1) — see `Home.tsx`.
 *
 * Same approach as `footer-success-text-contrast.test.ts`: read the real token values out of the
 * actual CSS sources and compute contrast with the WCAG relative-luminance formula. No ratio is
 * hardcoded — only source hex values and the >=4.5:1 threshold.
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

const AA_NORMAL_TEXT_MIN = 4.5;
const THEMES_DIR = resolve(__dirname, "..");

function read(file: string): string {
  return readFileSync(resolve(THEMES_DIR, file), "utf-8");
}

/** Isolates a single `:root[data-theme="<id>"] { ... }` block so multi-theme files parse per-preset. */
function themeBlock(source: string, themeId: string): string {
  const start = source.indexOf(`:root[data-theme="${themeId}"]`);
  if (start === -1) throw new Error(`Theme block ${themeId} not found`);
  const open = source.indexOf("{", start);
  const end = source.indexOf("\n}", open);
  return source.slice(open, end === -1 ? undefined : end);
}

/** Extracts a `--token: #hex;` declaration, ignoring commented-out prose that mentions the token. */
function extractHex(source: string, token: string): string {
  const match = source.match(new RegExp(`^\\s*${token}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`, "m"));
  if (!match) throw new Error(`Token ${token} (hex) not found in source`);
  return match[1];
}

const luxuryCss = read("atlas-luxury-multi-theme.css");
const defaultCss = read("default.css");
const baseCss = read("base.css");

/** The lavender host-note panel surface — `var(--lavender-soft, #f0eafd)`, a default.css literal. */
const LAVENDER_PANEL = "#f0eafd";

/**
 * Surfaces `classic`'s homepage paints from a default.css literal via a `var(..., <fallback>)`
 * fallback AND still renders `--text-muted` body copy on. Every preset inherits these whether or
 * not it defines the token behind them.
 *
 * NOTE the lavender host-note panel is deliberately NOT in this list. It used to belong here —
 * that pairing is exactly what failed (4.05-4.48 across all 6 presets) — but the fix rebound its
 * only muted line (the "— The <brand> host team" attribution) off `--text-muted` and onto
 * `--lavender-text`, so `--text-muted` is no longer painted on that surface at all. The panel's
 * contrast contract now lives in the `--lavender-text` describe block below. Re-binding anything
 * on that panel back to `--text-muted` would reintroduce the bug, which is why the two describe
 * blocks are split rather than merged.
 */
const INHERITED_TEXT_MUTED_SURFACES: Record<string, string> = {
  "why-direct strip (var(--bg-secondary, #fdf2e9))": "#fdf2e9",
};

/** Presets curated onto the `classic` layout by the theme-preset contrast matrix. */
const CLASSIC_PRESETS: { id: string; source: string; ownSurfaceToken: string }[] = [
  { id: "sunriseCoral", source: themeBlock(luxuryCss, "sunriseCoral"), ownSurfaceToken: "--bg-section-alt" },
  { id: "oceanLuxury", source: themeBlock(luxuryCss, "oceanLuxury"), ownSurfaceToken: "--bg-section-alt" },
  { id: "emeraldOasis", source: themeBlock(luxuryCss, "emeraldOasis"), ownSurfaceToken: "--bg-section-alt" },
  { id: "royalViolet", source: themeBlock(luxuryCss, "royalViolet"), ownSurfaceToken: "--bg-section-alt" },
  { id: "valentine", source: read("valentine.css"), ownSurfaceToken: "--bg-muted" },
  { id: "christmas", source: read("christmas.css"), ownSurfaceToken: "--bg-muted" },
  { id: "newYear", source: read("new-year.css"), ownSurfaceToken: "--bg-muted" },
];

describe("--text-muted clears WCAG AA on every surface classic renders it on", () => {
  describe.each(CLASSIC_PRESETS)("$id", ({ id, source, ownSurfaceToken }) => {
    const textMuted = hexToRgb(extractHex(source, "--text-muted"));

    it(`passes on its own ${ownSurfaceToken}`, () => {
      const ratio = contrastRatio(textMuted, hexToRgb(extractHex(source, ownSurfaceToken)));
      expect(ratio, `${id} --text-muted on its own ${ownSurfaceToken}`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
    });

    // The regression that shipped: these surfaces are inherited from default.css, not declared
    // by the preset, so they were never considered when the preset's --text-muted was chosen.
    it.each(Object.entries(INHERITED_TEXT_MUTED_SURFACES))("passes on the inherited %s", (label, surface) => {
      const ratio = contrastRatio(textMuted, hexToRgb(surface));
      expect(ratio, `${id} --text-muted on inherited ${label}`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
    });
  });
});

describe("--lavender-text carries the host-note panel", () => {
  // Home.tsx binds BOTH the panel's eyebrow and its attribution line to --lavender-text, so the
  // token must clear AA on the lavender surface for every preset that doesn't override it — i.e.
  // against base.css's fallback, which is what all 7 classic presets resolve to.
  it("base.css default passes on the lavender panel", () => {
    const lavenderText = hexToRgb(extractHex(baseCss, "--lavender-text"));
    const ratio = contrastRatio(lavenderText, hexToRgb(LAVENDER_PANEL));
    expect(ratio, "base.css --lavender-text on #f0eafd").toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
  });

  it("default.css keeps base.css's value in sync", () => {
    expect(extractHex(defaultCss, "--lavender-text").toLowerCase()).toBe(
      extractHex(baseCss, "--lavender-text").toLowerCase(),
    );
  });
});
