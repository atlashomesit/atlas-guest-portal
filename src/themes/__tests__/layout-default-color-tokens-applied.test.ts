/**
 * ADR-0081 D5/D6/D6b — proof that a layout theme's baked `defaultColorTokens` actually reach
 * `document.documentElement`, and with the right precedence relative to the color-preset axis.
 *
 * The sibling theme tests assert what the registry *declares* (`themeRegistry.coastal
 * .defaultColorTokens["--bg-primary"] === "#f2fbfd"`). That passed while the tokens were dead
 * data: nothing in `src/` ever painted them, so every non-classic layout silently rendered with
 * `default.css`'s coral palette. These tests assert the resolved *computed* value instead, which
 * is the only assertion that can tell the two states apart.
 *
 * jsdom implements the cascade and `getComputedStyle`, but NOT custom-property substitution on
 * shorthand/derived values — so we read the custom properties directly off the resolved style,
 * which is exactly the surface every shared component consumes via `var(--…)`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  _resetLayoutDefaultColorTokensForTests,
  applyLayoutDefaultColorTokens,
  applyTheme,
} from "@/styles/theme";
import {
  getLayoutThemeDefaultColorTokens,
  resolveColorPresetForLayout,
  themeRegistry,
} from "../registry";

/** Mirrors `src/main.tsx`'s boot sequence exactly — the thing actually under test. */
const boot = (layoutThemeId: keyof typeof themeRegistry, colorPresetId?: string | null) => {
  applyLayoutDefaultColorTokens(layoutThemeId, getLayoutThemeDefaultColorTokens(layoutThemeId));
  applyTheme(resolveColorPresetForLayout(layoutThemeId, colorPresetId) ?? DEFAULT_THEME);
};

const readToken = (property: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(property).trim();

/** jsdom drops the space after commas in list values (gradients, shadows) — compare shape, not spacing. */
const normalize = (value: string) => value.replace(/\s*,\s*/g, ",").replace(/\s+/g, " ").trim();

/**
 * `default.css` is not loaded in jsdom (Vite CSS imports are stubbed under vitest), so stand in
 * the one rule that matters for the precedence assertions: the coral base palette that every
 * non-classic layout was wrongly inheriting.
 */
let baseStylesheet: HTMLStyleElement;

beforeEach(() => {
  baseStylesheet = document.createElement("style");
  baseStylesheet.textContent = `
    :root, :root[data-theme="default"] { --bg-primary: #fff8e7; --footer-bg: #4a3333; }
    :root[data-theme="oceanLuxury"] { --bg-primary: #eef7fb; --footer-bg: #0b2b3a; }
  `;
  document.head.appendChild(baseStylesheet);
});

afterEach(() => {
  baseStylesheet.remove();
  _resetLayoutDefaultColorTokensForTests();
  delete document.documentElement.dataset.theme;
});

describe("layout defaultColorTokens reach the DOM (ADR-0081 D5/D6b)", () => {
  it.each([
    ["coastal", "#f2fbfd", "#082f3a"],
    ["editorial", undefined, undefined],
    ["noir", undefined, undefined],
    ["heritage", undefined, undefined],
    ["photoFirst", undefined, undefined],
  ] as const)("%s paints its own palette, not classic's coral", (layoutThemeId) => {
    const tokens = getLayoutThemeDefaultColorTokens(layoutThemeId);
    expect(tokens, `${layoutThemeId} should declare defaultColorTokens`).toBeDefined();

    boot(layoutThemeId);

    // Every declared token lands on the document — the assertion the old tests could not make.
    for (const [property, value] of Object.entries(tokens!)) {
      expect(normalize(readToken(property)), `${layoutThemeId} ${property}`).toBe(normalize(value));
    }
    expect(readToken("--bg-primary")).not.toBe("#fff8e7");
  });

  it("classic declares no palette and keeps default.css's coral base", () => {
    expect(getLayoutThemeDefaultColorTokens("classic")).toBeUndefined();

    boot("classic");

    expect(document.documentElement.dataset.layoutTheme).toBeUndefined();
    expect(readToken("--bg-primary")).toBe("#fff8e7");
    expect(readToken("--footer-bg")).toBe("#4a3333");
  });
});

describe("precedence against the color-preset axis (ADR-0081 D6)", () => {
  it("beats the base stylesheet's [data-theme=default] rule", () => {
    boot("coastal");

    // Regression guard for the specificity trap: `default.css` matches BOTH `:root` and
    // `:root[data-theme="default"]`, so the layout rule must outrank (0,2,0), not just (0,1,0).
    expect(document.documentElement.dataset.theme).toBe("default");
    expect(readToken("--bg-primary")).toBe("#f2fbfd");
    expect(readToken("--footer-bg")).toBe("#082f3a");
  });

  it("a preset the layout curates overrides the baked palette", () => {
    expect(themeRegistry.coastal.supportedColorPresets).toContain("oceanLuxury");

    boot("coastal", "oceanLuxury");

    expect(document.documentElement.dataset.theme).toBe("oceanLuxury");
    expect(document.documentElement.dataset.layoutTheme).toBeUndefined();
    expect(readToken("--bg-primary")).toBe("#eef7fb");
    expect(readToken("--footer-bg")).toBe("#0b2b3a");
  });

  it("a preset the layout does not curate is a safe no-op, falling back to the palette", () => {
    expect(themeRegistry.coastal.supportedColorPresets).not.toContain("christmas");

    boot("coastal", "christmas");

    expect(document.documentElement.dataset.theme).toBe("default");
    expect(readToken("--bg-primary")).toBe("#f2fbfd");
  });

  it("restores the baked palette when a runtime preset switch returns to default", () => {
    // The `ThemeProvider` / dev-switcher path: `applyTheme()` alone must re-arbitrate.
    boot("coastal", "oceanLuxury");
    expect(readToken("--bg-primary")).toBe("#eef7fb");

    applyTheme(DEFAULT_THEME);

    expect(document.documentElement.dataset.layoutTheme).toBe("coastal");
    expect(readToken("--bg-primary")).toBe("#f2fbfd");
  });

  it("yields to tenant branding's inline properties", () => {
    boot("coastal");
    expect(readToken("--brand-primary")).toBe("#0e7490");

    // `applyTenantBranding()` writes inline style properties for a tenant's custom primaryColor.
    document.documentElement.style.setProperty("--brand-primary", "#7c3aed");

    expect(readToken("--brand-primary")).toBe("#7c3aed");
    expect(readToken("--bg-primary")).toBe("#f2fbfd"); // untouched tokens still apply
    document.documentElement.style.removeProperty("--brand-primary");
  });

  it("switching layouts replaces the previous palette rather than layering on it", () => {
    boot("coastal");
    expect(readToken("--bg-primary")).toBe("#f2fbfd");

    boot("noir");

    expect(document.documentElement.dataset.layoutTheme).toBe("noir");
    expect(readToken("--bg-primary")).toBe(
      getLayoutThemeDefaultColorTokens("noir")!["--bg-primary"],
    );
    expect(document.querySelectorAll("#atlas-layout-theme-default-tokens")).toHaveLength(1);
  });
});
