/**
 * TASK-4950 — `validateTenant()` (the `GET /tenants/{slug}/public` fallback path used when
 * `resolveFromDomain()` returns null: any non-2xx, network hiccup, unregistered/dev host, or a
 * `tenantKey` config override) must resolve the same `effectiveThemeId`/`effectiveColorPresetId`
 * that `resolveFromDomain()` does, so a tenant with a real (entitled) premium layout/preset still
 * renders it — not silently "classic"/no preset.
 *
 * Mirrors `layout-default-color-tokens-applied.test.ts`'s `boot()` pattern: the only assertion
 * that can tell "wired but reading undefined" apart from "actually renders the tenant's theme" is
 * the resolved *computed* DOM value, not the parsed field alone.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTenantContext, validateTenant, _resetTenantContextForTests } from "@/tenant/tenantContext";
import {
  DEFAULT_THEME,
  _resetLayoutDefaultColorTokensForTests,
  applyLayoutDefaultColorTokens,
  applyTheme,
} from "@/styles/theme";
import { getLayoutThemeDefaultColorTokens, resolveColorPresetForLayout, resolveLayoutThemeId } from "../registry";

/** Mirrors `src/main.tsx`'s boot sequence exactly — the thing actually under test. */
const boot = (layoutThemeId: string | undefined, colorPresetId?: string | null) => {
  const resolved = resolveLayoutThemeId(layoutThemeId);
  applyLayoutDefaultColorTokens(resolved, getLayoutThemeDefaultColorTokens(resolved));
  applyTheme(resolveColorPresetForLayout(resolved, colorPresetId) ?? DEFAULT_THEME);
  return resolved;
};

const readToken = (property: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(property).trim();

async function validateTenantWithPayload(payload: Record<string, unknown>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => payload,
    }) as Response;
  try {
    return await validateTenant("some-slug");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/**
 * jsdom doesn't load `default.css` under vitest — stand in the one rule the DOM-level tests need
 * (mirrors `layout-default-color-tokens-applied.test.ts`'s own stub).
 */
let baseStylesheet: HTMLStyleElement;

beforeEach(() => {
  _resetTenantContextForTests();
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
  delete document.documentElement.dataset.layoutTheme;
});

describe("validateTenant() fallback path resolves the real theme (TASK-4950)", () => {
  it("parses effectiveThemeId/effectiveColorPresetId exactly as resolveFromDomain does", async () => {
    const info = await validateTenantWithPayload({
      id: 7,
      name: "Coastal Retreat",
      slug: "some-slug",
      effectiveThemeId: "coastal",
      effectiveColorPresetId: "oceanLuxury",
    });

    expect(info.effectiveThemeId).toBe("coastal");
    expect(info.effectiveColorPresetId).toBe("oceanLuxury");
    expect(getTenantContext()?.effectiveThemeId).toBe("coastal");
    expect(getTenantContext()?.effectiveColorPresetId).toBe("oceanLuxury");
  });

  it("parses a null effectiveColorPresetId through (no preset resolved) rather than dropping it", async () => {
    const info = await validateTenantWithPayload({
      id: 8,
      name: "Heritage House",
      slug: "some-slug",
      effectiveThemeId: "heritage",
      effectiveColorPresetId: null,
    });

    expect(info.effectiveThemeId).toBe("heritage");
    expect(info.effectiveColorPresetId).toBeNull();
  });

  it("resolves to undefined when the fields are absent (defensive parse, never assumes classic)", async () => {
    const info = await validateTenantWithPayload({ id: 9, name: "No Theme Fields", slug: "some-slug" });

    expect(info.effectiveThemeId).toBeUndefined();
    expect(info.effectiveColorPresetId).toBeUndefined();
  });

  it("boot() paints the tenant's real layout+preset on the DOM when resolveFromDomain returned null", async () => {
    // Simulates main.tsx: resolveFromDomain() failed (returned null), so validateTenant() is the
    // only source of tenant info. Before TASK-4950, TenantPublicDto never carried these fields, so
    // this always resolved "classic" + no preset regardless of what the tenant actually has.
    const info = await validateTenantWithPayload({
      id: 10,
      name: "Coastal Retreat",
      slug: "some-slug",
      effectiveThemeId: "coastal",
      effectiveColorPresetId: "oceanLuxury",
    });

    const resolvedLayout = boot(info.effectiveThemeId, info.effectiveColorPresetId);

    expect(resolvedLayout).toBe("coastal");
    expect(document.documentElement.dataset.theme).toBe("oceanLuxury");
    // oceanLuxury is a preset coastal curates (`supportedColorPresets`), so it wins over
    // coastal's own baked palette — same precedence layout-default-color-tokens-applied.test.ts
    // proves for the boot() sequence directly.
    expect(readToken("--bg-primary")).toBe("#eef7fb");
    expect(readToken("--footer-bg")).toBe("#0b2b3a");
  });

  it("boot() falls back to classic/default only when the fields are genuinely absent", async () => {
    const info = await validateTenantWithPayload({ id: 11, name: "Untethemed Tenant", slug: "some-slug" });

    const resolvedLayout = boot(info.effectiveThemeId, info.effectiveColorPresetId);

    expect(resolvedLayout).toBe("classic");
    expect(document.documentElement.dataset.layoutTheme).toBeUndefined();
  });
});
