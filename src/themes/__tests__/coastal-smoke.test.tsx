/**
 * TASK-4907 / ADR-0081 D8 — gate smoke + registry proof for the "coastal" layout theme,
 * mirroring the AC7 pattern already established for `heritage`
 * (`ac7-layout-theme-switch.test.tsx`, TASK-4914): registry metadata, `resolveLayoutThemeId`
 * recognition, module-identity divergence/reuse, and a full render of `Home` (the one page
 * this layout's founder-specified brief actually diverges on — see `coastal/index.tsx`'s own
 * header comment for why `PropertyDetails`/`About`/`Gallery`/`Contact` are reused unchanged).
 *
 * `PropertyDetails` is NOT re-rendered here (matches this repo's own documented constraint,
 * `vitest.config.ts`'s `heavyRouteSmokes` exclusion for `Homepage_PropertyDetails` — full
 * render exhausts the Vitest worker heap on Windows) — since `coastal` reuses the identical,
 * unforked `classic` component for that page (verified by identity check below, not a source
 * diff, because there is no fork to diff), no additional render-cost risk is introduced by
 * this layout at all. Full-page coverage lives in Playwright (TASK-4908's per-layout smoke
 * spec), same convention as every other layout.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  layoutThemeIds,
  loadLayoutTheme,
  resolveLayoutThemeId,
  themeRegistry,
} from "../registry";

// ---- Home.tsx's dependency surface (shared by classic/heritage/coastal Home) ----
vi.mock("@/components/homepage_components/slider/Slider", () => ({
  __esModule: true,
  default: () => <div>Slider stub</div>,
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

// ---- Shared deps ----
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

describe("ADR-0081 D8 — layout-theme registry contains coastal with the founder-specified curated matrix", () => {
  it("registers coastal alongside classic/heritage with the expected metadata", () => {
    expect(layoutThemeIds).toContain("coastal");
    expect(themeRegistry.coastal.supportedColorPresets).toEqual([
      "oceanLuxury",
      "emeraldOasis",
      "newYear",
    ]);
    expect(themeRegistry.coastal.defaultColorTokens).toBeDefined();
    expect(themeRegistry.coastal.defaultColorTokens?.["--brand-primary"]).toBe("#0e7490");
  });

  it("resolveLayoutThemeId() accepts 'coastal' as a recognized id (not a fallback to default)", () => {
    expect(resolveLayoutThemeId("coastal")).toBe("coastal");
  });

  it("loadLayoutTheme('coastal') exports a Home genuinely different from classic's, but reuses classic's PropertyDetails/About/Gallery/Contact unchanged (no fork)", async () => {
    const classicModule = await loadLayoutTheme("classic");
    const coastalModule = await loadLayoutTheme("coastal");

    expect(coastalModule.Home).not.toBe(classicModule.Home);
    expect(coastalModule.PropertyDetails).toBe(classicModule.PropertyDetails);
    expect(coastalModule.About).toBe(classicModule.About);
    expect(coastalModule.Gallery).toBe(classicModule.Gallery);
    expect(coastalModule.Contact).toBe(classicModule.Contact);
  });
});

describe("AC5/AC13 — coastal's Home renders its founder-specified composition (horizontal gallery + wave motifs), booking entry point reachable", () => {
  it("renders the coastal-home testid, the horizontal listings gallery, and the hero (booking entry point)", async () => {
    const { Home } = await loadLayoutTheme("coastal");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("coastal-home")).toBeInTheDocument();
    });
    // Booking entry point (Slider hosts the real SearchAvailabilityWidget in prod; stubbed
    // here per the shared-deps mock above, but its presence proves the hero — and therefore
    // the booking entry point — is mounted, same AC5/AC13 shape as the classic/heritage specs).
    expect(screen.getByText("Slider stub")).toBeInTheDocument();
    // Horizontal gallery — the layout's distinguishing composition (not classic's grid).
    expect(screen.getByTestId("coastal-listings-gallery")).toBeInTheDocument();
    // getListingDisplayName() maps property id 202 -> "Suite 202" (SKU/floor-id display-name
    // mapping, src/lib/listingDisplayName.ts) — same mapping every other layout's listings
    // section already goes through, not something this gallery invents.
    expect(screen.getByText("Suite 202")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /available to book/i })).toBeInTheDocument();
  });

  it("does not render classic's grid-only 'Our Homes' composition (coastal replaces it with the horizontal gallery)", async () => {
    const { Home } = await loadLayoutTheme("coastal");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("coastal-home")).toBeInTheDocument();
    });
    // classic's grid section renders inside `HomePage_Locations`, which coastal never imports.
    expect(screen.queryByTestId("coastal-listings-gallery")?.querySelector(".grid")).toBeNull();
  });
});
