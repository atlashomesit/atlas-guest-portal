/**
 * WCAG AA enforcement for on-CTA button labels.
 *
 * Every palette in this repo documents its contrast ratios in a header comment, hand-computed
 * and hand-maintained. That is exactly how `noir` shipped a gold `--cta-primary` (#d4af37)
 * whose comment claimed an 8.52:1 dark label while every shared button actually resolved its
 * label to `--text-contrast` (#ffffff) and rendered at 2.10:1 — the comment described a token
 * that did not exist. This test computes the ratios instead of trusting the prose, so the same
 * class of drift fails CI rather than a later manual audit.
 *
 * Scope: the label-on-filled-CTA pair only. Other text/background pairs stay documented in
 * each palette's own header comment.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { themeRegistry, layoutThemeIds } from "../registry";

const HERE = dirname(fileURLToPath(import.meta.url));

/** WCAG 2.1 relative luminance (sRGB), per https://www.w3.org/TR/WCAG21/#dfn-relative-luminance */
const relativeLuminance = (hex: string): number => {
  const channels = [1, 3, 5].map((i) => {
    const srgb = parseInt(hex.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (a: string, b: string): number => {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** The `base.css` fallbacks a palette inherits when it declares no on-CTA label of its own. */
const BASE_TEXT_ON_CTA = "#ffffff";
const AA_NORMAL_TEXT = 4.5;

/** Reads `:root[data-theme="..."]` custom properties out of a color-preset stylesheet. */
const readPresetTokens = (file: string): Record<string, string> => {
  const css = readFileSync(resolve(HERE, "../../styles/themes", file), "utf8");
  const tokens: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[name] = value;
  }
  return tokens;
};

/**
 * Every fill a CTA label can sit on. `--cta-secondary` is included because `ui.css`'s
 * `.rb-button` gradient ends on it, so a label drawn over that button has to clear AA at both
 * ends of the gradient, not just the `--cta-primary` end.
 */
const CTA_PAIRS = [
  { fill: "--cta-primary", label: "--text-on-cta" },
  { fill: "--cta-primary-hover", label: "--text-on-cta" },
  { fill: "--cta-secondary", label: "--text-on-cta" },
] as const;

/**
 * Pairs known NOT to clear AA, pinned deliberately rather than skipped so the gap stays visible.
 * These fail loudly if someone FIXES them — that is intended: the fix should also delete the
 * entry here. Each needs a design change, not a label-token change.
 */
const KNOWN_GAPS: Record<string, string> = {
  "coastal:--cta-secondary":
    "`ui.css`'s .rb-button gradient runs --cta-primary -> --cta-secondary. On coastal no single " +
    "label clears both ends: white is 5.36:1 on #0e7490 but 2.36:1 on #22b8d8, and teal ink " +
    "(#082f3a) is 6.03:1 on #22b8d8 but 2.65:1 on #0e7490. Needs a gradient or palette change.",
};

const assertPairs = (name: string, tokens: Record<string, string>) => {
  for (const { fill, label } of CTA_PAIRS) {
    const fillHex = tokens[fill];
    if (!fillHex) continue; // palette doesn't declare this fill; nothing renders on it
    const labelHex = tokens[label] ?? BASE_TEXT_ON_CTA;
    const ratio = contrastRatio(labelHex, fillHex);
    const gap = KNOWN_GAPS[`${name}:${fill}`];
    if (gap) {
      expect(
        ratio,
        `${name}: ${fill} was a known AA gap but now measures ${ratio.toFixed(2)}:1 — if this was ` +
          `fixed deliberately, delete its KNOWN_GAPS entry. Reason on record: ${gap}`,
      ).toBeLessThan(AA_NORMAL_TEXT);
      continue;
    }
    expect(
      ratio,
      `${name}: label ${labelHex} on ${fill} ${fillHex} = ${ratio.toFixed(2)}:1 (needs >=${AA_NORMAL_TEXT}:1)`,
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  }
};

describe("on-CTA label contrast (WCAG AA, normal text)", () => {
  it.each(layoutThemeIds)("layout palette: %s", (id) => {
    const tokens = themeRegistry[id].defaultColorTokens;
    if (!tokens) return; // `classic` ships no palette of its own — it renders the `default` preset
    assertPairs(id, tokens as Record<string, string>);
  });

  // `noir` is the only layout whose CTA fill is lighter than its page background, so it is the
  // only one whose curated presets need the same treatment as its own palette.
  it.each([
    ["privateIslandNoir", "private-island-noir.css"],
    ["emeraldDynasty", "emerald-dynasty.css"],
  ])("noir curated preset: %s", (name, file) => {
    assertPairs(name, readPresetTokens(file));
  });

  /**
   * The same "base.css default assumes the opposite background lightness" trap, one token
   * family over. `base.css` picks `--accent-text`/`--lavender-text` for LIGHT surfaces and asks
   * each theme to override; `noir` didn't, and its "1 night" chip rendered at 2.82:1. Checked
   * against every surface a palette declares, since the worst case was `--bg-muted`, not
   * `--bg-primary`.
   */
  const SURFACES = ["--bg-primary", "--bg-secondary", "--bg-card", "--bg-surface", "--bg-muted"];
  const ACCENT_TEXT = [
    { token: "--accent-text", base: "#a84832" },
    { token: "--lavender-text", base: "#6f5aa8" },
  ];

  it.each(layoutThemeIds)("small-accent text roles: %s", (id) => {
    const tokens = themeRegistry[id].defaultColorTokens as Record<string, string> | undefined;
    if (!tokens) return;
    for (const { token, base } of ACCENT_TEXT) {
      const hex = tokens[token] ?? base;
      for (const surface of SURFACES) {
        const bg = tokens[surface];
        if (!bg) continue;
        const ratio = contrastRatio(hex, bg);
        expect(
          ratio,
          `${id}: ${token} ${hex} on ${surface} ${bg} = ${ratio.toFixed(2)}:1 (needs >=${AA_NORMAL_TEXT}:1)`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    }
  });

  /**
   * `--brand-ink` has exactly one consumer — `navbar.css`'s `.util-bar`, which uses it as a dark
   * BACKGROUND behind hardcoded warm-light text. A palette that reads the name as "light ink"
   * instead renders light-on-light; noir did, at 1.04-1.70:1.
   */
  it.each(layoutThemeIds)("util-bar text on --brand-ink: %s", (id) => {
    const tokens = themeRegistry[id].defaultColorTokens as Record<string, string> | undefined;
    const bg = tokens?.["--brand-ink"];
    if (!bg) return;
    for (const fg of ["#cbb89b", "#ffe8d6"]) {
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `${id}: .util-bar text ${fg} on --brand-ink ${bg} = ${ratio.toFixed(2)}:1 (needs >=${AA_NORMAL_TEXT}:1)`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });

  it("noir's gold CTA specifically regresses if the label token is dropped", () => {
    const tokens = themeRegistry.noir.defaultColorTokens as Record<string, string>;
    expect(tokens["--cta-primary"]).toBe("#d4af37");
    // The original defect, pinned: inheriting base.css's white default here is 2.10:1.
    expect(contrastRatio(BASE_TEXT_ON_CTA, tokens["--cta-primary"])).toBeLessThan(AA_NORMAL_TEXT);
    expect(contrastRatio(tokens["--text-on-cta"], tokens["--cta-primary"])).toBeGreaterThan(9);
  });
});
