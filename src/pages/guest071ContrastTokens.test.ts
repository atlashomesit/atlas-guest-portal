import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

type Rgb = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

describe("GUEST-071: AA-compliant brand primary text shade (#9e351d / text-primary-dark)", () => {
  const srcRoot = resolve(__dirname, "..");

  it("defines --brand-primary-dark: #9e351d and --color-primary-dark with >= 4.5:1 contrast on tinted surfaces", () => {
    const defaultCss = readFileSync(resolve(srcRoot, "styles/themes/default.css"), "utf-8");
    const baseCss = readFileSync(resolve(srcRoot, "styles/themes/base.css"), "utf-8");
    const indexCss = readFileSync(resolve(srcRoot, "index.css"), "utf-8");

    expect(defaultCss).toContain("--brand-primary-dark: #9e351d;");
    expect(baseCss).toContain("--brand-primary-dark: #9e351d;");
    expect(indexCss).toContain("--color-primary-dark: var(--brand-primary-dark, #9e351d);");

    const fg = hexToRgb("#9e351d");
    for (const bgHex of ["#f5c8b0", "#fde0c8", "#f9ecea", "#ffffff"]) {
      expect(contrastRatio(fg, hexToRgb(bgHex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses text-primary-dark on FAQ, Policies, Terms, About, Offers, Amenities, and Gallery eyebrows/chips", () => {
    for (const page of [
      "FaqPage.tsx",
      "Policies.tsx",
      "Terms.tsx",
      "AboutPage.tsx",
      "OffersPage.tsx",
      "Amenities.tsx",
      "GalleryPage.tsx",
    ]) {
      const content = readFileSync(resolve(__dirname, page), "utf-8");
      expect(content).toContain("text-primary-dark");
    }

    const galleryContent = readFileSync(resolve(__dirname, "GalleryPage.tsx"), "utf-8");
    expect(galleryContent).toContain('activeSegment === segment.id ? "text-[var(--text-on-cta)]" : "text-text-muted"');
  });
});
