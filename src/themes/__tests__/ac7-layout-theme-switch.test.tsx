/**
 * TASK-4914 / ADR-0081 amendment 2026-07-17 pt.5, epic AC7 — proof that the layout-theme
 * registry (`src/themes/registry.ts`, TASK-4903) supports switching a resolved layout id
 * from `classic` to `heritage` and back with no build/deploy, exactly as `src/main.tsx`
 * does at boot (`resolveLayoutThemeId()` + `setCurrentLayoutThemeId()`), and that the two
 * layouts render genuinely different page composition for the two pages the pre-coral
 * recovery (TASK-4914) touched (`Home`, `PropertyDetails`) — the epic's own "first real
 * two-layouts-one-deploy proof" claim (epic §"Why").
 *
 * TASK-4904 (the server-side `WebsiteThemeId`/entitlement plumbing) has not landed yet, so
 * there is no live tenant to flip in the database for an E2E-level demonstration — this
 * test instead exercises the exact registry API `main.tsx`/`App.tsx` already call
 * (`resolveLayoutThemeId`, `setCurrentLayoutThemeId`, `getCurrentLayoutThemeId`,
 * `loadLayoutTheme`), which is the real, already-shipped (TASK-4903) switching mechanism —
 * per this task's instruction, no new prod-facing selection surface is introduced here.
 *
 * Distinguishing marker: the "A note from your host" lavender callout panel was added by
 * the coral redesign (`d1ab2590`) to both `Home` and `PropertyDetails` and is absent from
 * the recovered pre-coral composition — a real, content-level structural difference (not a
 * synthetic test-only flag) that both pages already carry.
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  DEFAULT_LAYOUT_THEME_ID,
  getCurrentLayoutThemeId,
  layoutThemeIds,
  loadLayoutTheme,
  resolveLayoutThemeId,
  setCurrentLayoutThemeId,
  themeRegistry,
} from "../registry";

// ---- Home.tsx's dependency surface (shared by both classic's and heritage's Home) ----
vi.mock("@/components/homepage_components/slider/Slider", () => ({
  __esModule: true,
  default: () => <div>Slider stub</div>,
}));
vi.mock("@/components/homepage_components/homepage_locations/HomePage_Locations", () => ({
  __esModule: true,
  default: () => <div>Locations stub</div>,
}));
vi.mock("@/components/home/ServicesSection", () => ({
  __esModule: true,
  default: () => <div>Services stub</div>,
}));
vi.mock("@/components/home/TestimonialsSection", () => ({
  __esModule: true,
  default: () => <div>Testimonials stub</div>,
}));
vi.mock("@/components/home/FooterCtaStrip", () => ({
  __esModule: true,
  default: () => <div>FooterCtaStrip stub</div>,
}));
vi.mock("@/components/home/AtlasNeighbourhoodRibbon", () => ({
  __esModule: true,
  default: () => <div>Ribbon stub</div>,
}));
vi.mock("@/components/faq/FaqHighlights", () => ({
  __esModule: true,
  default: () => <div>FaqHighlights stub</div>,
}));

// ---- Shared deps for both pages ----
// NOTE: `loadLayoutTheme()` below imports the whole theme package module (which includes
// `PropertyDetails.tsx`) to check module-level export identity — this only evaluates
// top-level module code, it never renders the component (React.lazy()'s inner import()
// only fires on actual Suspense-triggered render), so this stays outside the
// heap-exhaustion risk described in the PropertyDetails describe block below.
vi.mock("@/utils/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/utils/pricing", () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 1000 })),
  inferUnitType: vi.fn(() => "1bhk"),
  getEffectiveDiscountPercent: vi.fn(() => 0),
}));
vi.mock("@/contexts/BookingContext", () => ({
  useBooking: () => ({
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: 2 },
    setProperty: vi.fn(),
    setPendingScrollTarget: vi.fn(),
    updateBooking: vi.fn(),
    setDates: vi.fn(),
    setGuests: vi.fn(),
    pendingScrollTarget: null,
  }),
  BookingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/useTenantListings", () => ({
  useTenantListings: vi.fn(() => ({
    listings: [],
    properties: [
      {
        id: 202,
        listingId: 4,
        property_name: "Atlas Homes Room 202",
        property_location: "Hyderabad",
        property_img: ["img1.jpg"],
        property_amenities: [{ amenities_icon: "wifi" }],
        property_description: "Test",
        property_policy_details: [],
        property_rating: 4.5,
        property_reviews: 10,
        maxGuests: 2,
        unitType: "1bhk",
      },
    ],
    state: "success",
    fetchErrorMessage: null,
    refetch: vi.fn(),
  })),
}));
vi.mock("@/utils/listingResolver", () => ({
  resolveListing: vi.fn().mockResolvedValue({
    id: 4,
    propertyId: 1,
    name: "Atlas202",
  }),
}));

describe("ADR-0081 D1/D2/AC7 — layout-theme registry contains both classic and heritage", () => {
  it("registers heritage alongside classic with the expected curated-matrix metadata", () => {
    expect(layoutThemeIds).toContain("classic");
    expect(layoutThemeIds).toContain("heritage");
    expect(DEFAULT_LAYOUT_THEME_ID).toBe("classic"); // heritage is opt-in, never the default
    expect(themeRegistry.heritage.supportedColorPresets).toEqual([]);
    expect(themeRegistry.heritage.defaultColorTokens).toBeDefined();
    expect(themeRegistry.heritage.defaultColorTokens?.["--brand-primary"]).toBe("#c2410c");
  });

  it("resolveLayoutThemeId() accepts 'heritage' as a recognized id (not a fallback to default)", () => {
    expect(resolveLayoutThemeId("heritage")).toBe("heritage");
    expect(resolveLayoutThemeId("not-a-real-theme")).toBe("classic");
    expect(resolveLayoutThemeId(undefined)).toBe("classic");
  });

  it("AC7 — one-flag switch: setCurrentLayoutThemeId flips classic -> heritage -> classic with no rebuild, mirroring main.tsx's boot-time resolution of a tenant's effectiveThemeId", () => {
    // Simulates main.tsx: `setCurrentLayoutThemeId(resolveLayoutThemeId(resolved?.effectiveThemeId))`
    setCurrentLayoutThemeId(resolveLayoutThemeId("classic"));
    expect(getCurrentLayoutThemeId()).toBe("classic");

    // "next page load" for a tenant whose WebsiteThemeId DB column was updated to "heritage"
    setCurrentLayoutThemeId(resolveLayoutThemeId("heritage"));
    expect(getCurrentLayoutThemeId()).toBe("heritage");

    // switching back
    setCurrentLayoutThemeId(resolveLayoutThemeId("classic"));
    expect(getCurrentLayoutThemeId()).toBe("classic");
  });

  it("loadLayoutTheme('classic') and loadLayoutTheme('heritage') resolve to genuinely different page-component modules", async () => {
    const classicModule = await loadLayoutTheme("classic");
    const heritageModule = await loadLayoutTheme("heritage");

    expect(classicModule.Home).not.toBe(heritageModule.Home);
    expect(classicModule.PropertyDetails).not.toBe(heritageModule.PropertyDetails);
    // About/Gallery/Contact never diverged from the coral redesign (TASK-4914 recovery
    // scope) — heritage re-exports the same current, shared page components as classic.
    expect(classicModule.About).toBe(heritageModule.About);
    expect(classicModule.Gallery).toBe(heritageModule.Gallery);
    expect(classicModule.Contact).toBe(heritageModule.Contact);
  });
});

describe("AC7 — classic and heritage Home render genuinely different composition", () => {
  it("classic's Home renders the coral redesign's 'A note from your host' panel", async () => {
    const { Home } = await loadLayoutTheme("classic");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/A note from your host/i)).toBeInTheDocument();
    });
  });

  it("heritage's Home does NOT render the coral-only 'A note from your host' panel and carries its own testid", async () => {
    const { Home } = await loadLayoutTheme("heritage");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("heritage-home")).toBeInTheDocument();
    });
    expect(screen.queryByText(/A note from your host/i)).not.toBeInTheDocument();
  });
});

// NOTE on PropertyDetails: this repo's own `vitest.config.ts` documents that fully
// rendering `Homepage_PropertyDetails` (react-icons + lucide-react + Fancybox + lazy
// map/tour/review chunks) exhausts the Vitest worker heap on Windows —
// `tests/propertyDetailsRouteSmoke.test.tsx`/`tests/PropertyDetailsMedia.test.tsx` are
// already excluded from the gated suite for exactly this reason (`heavyRouteSmokes`,
// "run explicitly or cover via Playwright"). Rendering BOTH classic's and heritage's
// full PropertyDetails tree in the same run reproduced that exact OOM during this task's
// own validation. Per that established project constraint, this AC7 proof for
// PropertyDetails uses the same source-content-assertion pattern this component's own
// colocated test file already uses (`Homepage_PropertyDetails.test.tsx`) instead of a
// full render — still an automated, CI-enforced structural-diff check, without the
// known-unsafe render cost. Full-render coverage for this page belongs in Playwright
// (TASK-4908's per-layout smoke specs), consistent with the existing convention.
describe("AC7 — classic and heritage PropertyDetails carry genuinely different composition", () => {
  const classicSource = readFileSync(
    resolve(__dirname, "../../components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx"),
    "utf-8",
  );
  const heritageSource = readFileSync(resolve(__dirname, "../heritage/PropertyDetails.tsx"), "utf-8");

  it("classic's PropertyDetails source contains the coral redesign's 'A note from your host' panel", () => {
    expect(classicSource).toContain("A note from your host");
  });

  it("heritage's PropertyDetails source does NOT contain the coral-only host-note panel and carries its own testid", () => {
    expect(heritageSource).not.toContain("A note from your host");
    expect(heritageSource).toContain('data-testid="heritage-property-details"');
  });

  it("heritage's PropertyDetails imports the CURRENT shared map-selection logic, not a forked copy", () => {
    expect(heritageSource).toContain(
      "@/components/homepage_components/homepage_Propertydetails/propertyMapMode",
    );
  });
});
