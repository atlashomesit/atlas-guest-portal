/**
 * REV-046 follow-up - the "Guest feedback" block must clear WCAG AA (4.5:1 normal text) under EVERY
 * theme preset, using the theme's own tokens.
 *
 * Two real failures found by the local contrast gate (`guest-portal-theme-preset-contrast`, 2026-10-30):
 *
 *  1. Listing page, noir presets (privateIslandNoir, emeraldDynasty): the "Guest feedback" label pill
 *     paints `var(--text-primary)` on `var(--brand-soft)`. The listing page stays light for the noir
 *     presets (Homepage_PropertyDetails.css pins the ink and surface tokens inside `.pp-root`), and that
 *     pin block pinned `--text-primary` (#3b1f1e) but forgot `--brand-soft`, so the pill kept the noir
 *     preset's DARK `--brand-soft` (#161922 / #112d1e): dark-brown text on a dark pill, 1.17 and 1.01:1.
 *  2. Home page, editorial presets (auroraChampagne, jetsetPearl, loversRetreatBlush): the line
 *     "Notes shared by guests..." was `text-text-muted` on the testimonials band, which paints
 *     `var(--bg-secondary)` (default.css #fde0c8 for these presets): 4.13 to 4.41:1.
 *
 * Same approach as the sibling files: read the real token values out of the CSS sources and compute the
 * WCAG ratio. Only the 4.5:1 threshold is fixed here; every colour comes from the sources.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

type Rgb = [number, number, number];

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: Rgb, b: Rgb): number {
  const l1 = luminance(a) + 0.05;
  const l2 = luminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}
function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

const AA = 4.5;
const SRC = resolve(__dirname, "../../..");
const THEMES_DIR = resolve(SRC, "styles/themes");
const read = (path: string) => readFileSync(path, "utf-8");
const readTheme = (file: string) => read(resolve(THEMES_DIR, file));

/** Isolates one `:root[data-theme="<id>"] { ... }` block. */
function themeBlock(source: string, themeId: string): string {
  const start = source.indexOf(`:root[data-theme="${themeId}"] {`);
  if (start === -1) throw new Error(`Theme block ${themeId} not found`);
  const open = source.indexOf("{", start);
  const end = source.indexOf("\n}", open);
  return source.slice(open, end === -1 ? undefined : end);
}

const luxuryCss = readTheme("atlas-luxury-multi-theme.css");
const defaultCss = readTheme("default.css");
const propertyCss = read(
  resolve(SRC, "components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.css"),
);

/** The block that pins the listing page back to light tokens for the two dark presets. */
function noirListingPinBlock(): string {
  const start = propertyCss.indexOf(':root[data-theme="privateIslandNoir"] .pp-root,');
  if (start === -1) throw new Error("noir listing-page pin block not found");
  const open = propertyCss.indexOf("{", start);
  return propertyCss.slice(open, propertyCss.indexOf("\n}", open));
}

const PRESETS: { id: string; block: string; listingPinned: boolean }[] = [
  { id: "default", block: themeBlock(defaultCss, "default"), listingPinned: false },
  { id: "sunriseCoral", block: themeBlock(luxuryCss, "sunriseCoral"), listingPinned: false },
  { id: "oceanLuxury", block: themeBlock(luxuryCss, "oceanLuxury"), listingPinned: false },
  { id: "emeraldOasis", block: themeBlock(luxuryCss, "emeraldOasis"), listingPinned: false },
  { id: "royalViolet", block: themeBlock(luxuryCss, "royalViolet"), listingPinned: false },
  { id: "valentine", block: readTheme("valentine.css"), listingPinned: false },
  { id: "christmas", block: readTheme("christmas.css"), listingPinned: false },
  { id: "newYear", block: readTheme("new-year.css"), listingPinned: false },
  { id: "loversRetreatBlush", block: readTheme("lovers-retreat-blush.css"), listingPinned: false },
  { id: "auroraChampagne", block: readTheme("aurora-champagne.css"), listingPinned: false },
  { id: "jetsetPearl", block: readTheme("jetset-pearl.css"), listingPinned: false },
  { id: "privateIslandNoir", block: readTheme("private-island-noir.css"), listingPinned: true },
  { id: "emeraldDynasty", block: readTheme("emerald-dynasty.css"), listingPinned: true },
];

const defaultBlock = themeBlock(defaultCss, "default");

function declared(block: string, token: string): string | undefined {
  return block.match(new RegExp(`^\\s*${token}:\\s*([^;]+);`, "m"))?.[1].trim();
}

/** Resolves a token the way the browser does: scoped pin, then the preset, then default.css's :root layer. */
function resolveToken(token: string, layers: string[], depth = 0): Rgb {
  if (depth > 4) throw new Error(`${token}: var() chain too deep`);
  for (const layer of layers) {
    const value = declared(layer, token);
    if (value === undefined) continue;
    const ref = value.match(/^var\((--[a-z0-9-]+)/i);
    if (ref) return resolveToken(ref[1], layers, depth + 1);
    if (!/^#[0-9a-f]{3,8}$/i.test(value)) throw new Error(`${token} is not a hex colour: ${value}`);
    return hexToRgb(value);
  }
  throw new Error(`${token} not defined in any layer`);
}

/** `var(--token` names a style binds in a source snippet, e.g. background: 'var(--brand-soft, #fdf2e9)'. */
function boundToken(source: string, property: string, scope: string): string {
  const scoped = source.slice(source.indexOf(scope));
  const match = scoped.match(new RegExp(`${property}:\\s*['"]var\\((--[a-z0-9-]+)`));
  if (!match) throw new Error(`${property} binding not found after ${scope}`);
  return match[1];
}

describe("REV-046 listing-page 'Guest feedback' label (GuestFeedbackCards.tsx)", () => {
  const cards = read(resolve(SRC, "components/property/GuestFeedbackCards.tsx"));
  const bgToken = boundToken(cards, "background", "const labelStyle");
  const fgToken = boundToken(cards, "color", "const labelStyle");

  it.each(PRESETS)("$id: the label text clears AA on the label pill", ({ block, listingPinned }) => {
    // The listing page scope (.pp-root) wins over the preset for the pinned presets.
    const layers = listingPinned ? [noirListingPinBlock(), block, defaultBlock] : [block, defaultBlock];
    const ratio = contrast(resolveToken(fgToken, layers), resolveToken(bgToken, layers));
    expect(ratio, `${fgToken} on ${bgToken}`).toBeGreaterThanOrEqual(AA);
  });
});

describe("REV-046 home-page 'Notes shared by guests' line (TestimonialsSection.tsx)", () => {
  const testimonials = read(resolve(SRC, "components/home/TestimonialsSection.tsx"));
  const bandBgToken = boundToken(testimonials, "backgroundColor", "const testimonialsBandStyle");

  it("the note line and the band header line bind to the AA-safe secondary text token, not --text-muted", () => {
    const noteLine = testimonials.match(/<p className="([^"]*)">\s*Notes shared by guests\./);
    expect(noteLine, "the 'Notes shared by guests' paragraph").not.toBeNull();
    expect(noteLine![1]).toContain("text-text-secondary");
    expect(noteLine![1]).not.toContain("text-text-muted");
    const headerLine = testimonials.match(/<p className="([^"]*)">\{supportingLine \?\? testimonialsCopy\.supporting\}/);
    expect(headerLine, "the band header supporting paragraph").not.toBeNull();
    expect(headerLine![1]).toContain("text-text-secondary");
  });

  it.each(PRESETS)("$id: --text-secondary clears AA on the testimonials band surface", ({ block }) => {
    const layers = [block, defaultBlock];
    const ratio = contrast(resolveToken("--text-secondary", layers), resolveToken(bandBgToken, layers));
    expect(ratio, `--text-secondary on ${bandBgToken}`).toBeGreaterThanOrEqual(AA);
  });
});
