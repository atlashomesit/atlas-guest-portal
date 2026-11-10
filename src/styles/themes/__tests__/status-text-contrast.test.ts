/**
 * 2026-11-10 UX audit (slot A): two noir-layout contrast failures on the booking funnel.
 *
 *  1. Guest details page, every noir palette: the cancellation timeline painted its two dates
 *     with fixed Tailwind `text-emerald-700` / `text-rose-700` on the theme's `bg-bg-surface`.
 *     Under noir that surface is near-black (#12141b / #0f1117 / #0a1f14): 3.42:1 and 3.04:1.
 *     The dates now use `--status-positive-text` / `--status-negative-text`, light-tuned in
 *     base.css and overridden by every palette that paints a dark surface.
 *  2. Listing page, noir layout with NO colour preset: `.pp-root` stays light, but its ink/surface
 *     pin only listed the two noir presets. The noir layout's own default palette (applied through
 *     `html:root[data-layout-theme="noir"]`) leaked its dark-ground inks onto the cream page:
 *     128 axe nodes, 1.55:1 to 3.01:1.
 *
 * Every colour is read from the sources; only the 4.5:1 threshold is fixed here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { themeRegistry } from "../../../themes/registry";

type Rgb = [number, number, number];
const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const hexToRgb = (hex: string): Rgb => {
  const c = hex.replace("#", "");
  const f = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
const ratio = (a: string, b: string) => {
  const l1 = lum(hexToRgb(a)) + 0.05;
  const l2 = lum(hexToRgb(b)) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
};

const AA = 4.5;
const SRC = resolve(__dirname, "../../..");
const THEMES = resolve(SRC, "styles/themes");
const read = (p: string) => readFileSync(p, "utf-8");

/** First top-level declaration of `token` in a CSS block, or undefined. */
const decl = (css: string, token: string): string | undefined => {
  const m = css.match(new RegExp(`${token.replace(/[-]/g, "\\-")}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  return m?.[1];
};

const baseCss = read(resolve(THEMES, "base.css"));
const defaultCss = read(resolve(THEMES, "default.css"));
const STATUS = ["--status-positive-text", "--status-negative-text"];
const SURFACES = ["--bg-surface", "--bg-card"];

describe("cancellation timeline status text (2026-11-10 slot A)", () => {
  it("base.css declares both status text roles", () => {
    for (const t of STATUS) expect(decl(baseCss, t), `${t} missing from base.css`).toBeTruthy();
  });

  // Every colour-preset CSS file: its own surface (or default.css's) vs its own status token (or base's).
  // ultra-yacht-azure.css is left out on purpose: no layout lists it in supportedColorPresets, and its
  // dark --bg-surface + white --bg-card fallback has no single status colour that clears both.
  const presetFiles = [
    "default.css", "private-island-noir.css", "emerald-dynasty.css",
    "christmas.css", "valentine.css", "new-year.css", "jetset-pearl.css", "aurora-champagne.css",
    "lovers-retreat-blush.css",
  ];
  it.each(presetFiles)("status text clears AA on the preset's surfaces: %s", (file) => {
    const css = read(resolve(THEMES, file));
    const failures: string[] = [];
    for (const t of STATUS) {
      const fg = decl(css, t) ?? decl(baseCss, t);
      expect(fg, `${t} unresolved for ${file}`).toBeTruthy();
      for (const s of SURFACES) {
        const bg = decl(css, s) ?? decl(defaultCss, s);
        if (!bg) continue;
        const r = ratio(fg!, bg);
        if (r < AA) failures.push(`${t} ${fg} on ${s} ${bg} = ${r.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it.each(Object.keys(themeRegistry))("status text clears AA on the layout's default palette: %s", (id) => {
    const tokens = themeRegistry[id as keyof typeof themeRegistry].defaultColorTokens as
      | Record<string, string>
      | undefined;
    if (!tokens) return;
    const failures: string[] = [];
    for (const t of STATUS) {
      const fg = tokens[t] ?? decl(baseCss, t)!;
      for (const s of SURFACES) {
        const bg = tokens[s];
        if (!bg) continue;
        const r = ratio(fg, bg);
        if (r < AA) failures.push(`${t} ${fg} on ${s} ${bg} = ${r.toFixed(2)}:1`);
      }
    }
    expect(failures, `${id}`).toEqual([]);
  });

  it("the timeline dates use the status tokens, not fixed Tailwind shades", () => {
    const src = read(resolve(SRC, "components/booking/CancellationMilestoneTimeline.tsx"));
    expect(src).not.toMatch(/font-bold text-emerald-700/);
    expect(src).not.toMatch(/font-bold text-rose-700/);
    expect(src).toContain("var(--status-positive-text)");
    expect(src).toContain("var(--status-negative-text)");
  });
});

describe("listing page light pin covers the noir layout's own default palette", () => {
  it("Homepage_PropertyDetails.css pins .pp-root under data-layout-theme=noir", () => {
    const css = read(resolve(SRC, "components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.css"));
    const pinStart = css.indexOf(':root[data-theme="privateIslandNoir"] .pp-root');
    const selectorList = css.slice(Math.max(0, pinStart - 200), css.indexOf("{", pinStart));
    expect(selectorList).toContain(':root[data-layout-theme="noir"] .pp-root');
  });
});
