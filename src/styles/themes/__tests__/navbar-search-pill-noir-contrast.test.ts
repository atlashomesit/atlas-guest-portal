/**
 * TASK-5361 — noir layout's navbar search pill ("Where to?" / "Search stays") failed WCAG AA
 * color-contrast under the `emeraldDynasty` and `privateIslandNoir` presets.
 *
 * Root cause: `.navbar-search-pill` (navbar.css) originally hardcoded
 * `background: rgba(255, 250, 245, 0.95)` (a light cream) unconditionally, while its two child
 * labels bind to `--text-primary` / `--text-muted` — tokens both noir presets tune for their own
 * DARK grounds. On a light-cream pill, that produces near-invisible text (measured off-line:
 * emeraldDynasty's `--text-muted` #8ba898 on the hardcoded cream is ~2.48:1; privateIslandNoir's
 * #c7c2b8 is ~1.71:1 — both well under the 4.5:1 AA floor for this ~12px label).
 *
 * The fix (already present in this branch's history, `--navbar-search-pill-bg`/`-border` added to
 * both presets + `navbar.css`'s `.navbar-search-pill` rebound to
 * `var(--navbar-search-pill-bg, <light fallback>)`) landed with no dedicated regression test —
 * this file closes that gap so the pill's background can never silently regress back to the
 * hardcoded literal, or drift out of sync with `--text-muted`/`--text-primary`, without a test
 * failure. Verified live against a running instance of this app (noir layout, both presets,
 * `.navbar-search-pill` computed style) before writing this test: 5.75:1 (emeraldDynasty hint),
 * 13.61:1 (emeraldDynasty label), 9.90:1 (privateIslandNoir hint), 15.57:1 (privateIslandNoir
 * label) — all comfortably clear AA.
 *
 * Same approach as the sibling files in this directory: read real token values out of the actual
 * CSS sources and compute contrast with the WCAG relative-luminance formula. No ratio is
 * hardcoded — only source hex values and the >=4.5:1 normal-text AA threshold (the pill's hint/
 * label are ~12-14px, i.e. normal text, not the 18px+/14px-bold "large text" 3:1 tier).
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
const NAVBAR_CSS_PATH = resolve(__dirname, "../../../components/commonComponents/navbar/navbar.css");

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

/** Extracts a `--token: #hex;` declaration. */
function extractHex(source: string, token: string): string {
  const match = source.match(new RegExp(`^\\s*${token}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`, "m"));
  if (!match) throw new Error(`Token ${token} (hex) not found in source`);
  return match[1];
}

/** Resolves a token that is itself declared as `var(--other-token)` back to that other token's hex. */
function resolveVarToken(source: string, token: string): string {
  const declMatch = source.match(new RegExp(`^\\s*${token}:\\s*var\\((--[a-z0-9-]+)\\)\\s*;`, "im"));
  if (!declMatch) throw new Error(`Token ${token} (var reference) not found in source`);
  return extractHex(source, declMatch[1]);
}

const NOIR_PRESETS: { id: string; file: string }[] = [
  { id: "emeraldDynasty", file: "emerald-dynasty.css" },
  { id: "privateIslandNoir", file: "private-island-noir.css" },
];

describe("navbar.css: .navbar-search-pill background is theme-driven, not hardcoded", () => {
  const navbarCss = readFileSync(NAVBAR_CSS_PATH, "utf-8");

  it("reads --navbar-search-pill-bg (with the light literal only as fallback), never the literal alone", () => {
    const pillBlock = navbarCss.slice(
      navbarCss.indexOf(".navbar-search-pill {"),
      navbarCss.indexOf(".navbar-search-pill:hover"),
    );
    expect(pillBlock).toContain("background: var(--navbar-search-pill-bg,");
  });
});

describe("TASK-5361 — noir navbar search pill clears WCAG AA on emeraldDynasty/privateIslandNoir", () => {
  describe.each(NOIR_PRESETS)("$id", ({ id, file }) => {
    const source = themeBlock(read(file), id);

    it("declares --navbar-search-pill-bg pointing at its own dark --bg-muted (not left to the light default)", () => {
      const resolvedBg = resolveVarToken(source, "--navbar-search-pill-bg");
      const bgMuted = extractHex(source, "--bg-muted");
      expect(resolvedBg.toLowerCase()).toBe(bgMuted.toLowerCase());
    });

    it("--text-muted (.navbar-search-pill__hint, 'Search stays') passes AA on the resolved pill background", () => {
      const textMuted = hexToRgb(extractHex(source, "--text-muted"));
      const pillBg = hexToRgb(resolveVarToken(source, "--navbar-search-pill-bg"));
      const ratio = contrastRatio(textMuted, pillBg);
      expect(ratio, `${id} --text-muted on --navbar-search-pill-bg`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
    });

    it("--text-primary (.navbar-search-pill__label, 'Where to?') passes AA on the resolved pill background", () => {
      const textPrimary = hexToRgb(extractHex(source, "--text-primary"));
      const pillBg = hexToRgb(resolveVarToken(source, "--navbar-search-pill-bg"));
      const ratio = contrastRatio(textPrimary, pillBg);
      expect(ratio, `${id} --text-primary on --navbar-search-pill-bg`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN);
    });

    // The regression this whole file guards against: without --navbar-search-pill-bg, the pill
    // falls back to navbar.css's hardcoded light cream, and BOTH presets' dark-tuned text fails
    // hard against it. Locking this in so nobody "simplifies" it away as dead-looking CSS.
    it("--text-muted FAILS AA against the light fallback the pill used before the fix (proves the fix is load-bearing)", () => {
      const textMuted = hexToRgb(extractHex(source, "--text-muted"));
      const lightFallback = hexToRgb("#fffaf5"); // rgba(255, 250, 245, 0.95) over white, approximated opaque
      const ratio = contrastRatio(textMuted, lightFallback);
      expect(ratio, `${id} --text-muted on the pre-fix light fallback`).toBeLessThan(AA_NORMAL_TEXT_MIN);
    });
  });
});
