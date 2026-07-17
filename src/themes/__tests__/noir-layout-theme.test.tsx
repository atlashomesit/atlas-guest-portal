/**
 * TASK-4906 / ADR-0081 D8 — proof that the "noir" ("dark luxury noir") layout theme is
 * registered in the layout-theme registry (`src/themes/registry.ts`, TASK-4903) with the
 * curated `supportedColorPresets` matrix and its own authored default palette, and that its
 * `Home` page renders the founder-specified full-bleed/minimal-chrome composition — a
 * genuinely different structure from `classic`'s `Slider`-based split hero and `heritage`'s
 * recovered pre-coral layout. Mirrors the AC7 test pattern in
 * `src/themes/__tests__/ac7-layout-theme-switch.test.tsx` (TASK-4914).
 *
 * PropertyDetails/About/Gallery/Contact are intentionally NOT re-rendered here: noir
 * re-exports the current, shared page components for those verbatim (see `noir/index.tsx`'s
 * header comment) — there is no new composition to exercise for them, and full-rendering
 * `Homepage_PropertyDetails` is documented (`vitest.config.ts`, and the AC7 test file's own
 * note) to exhaust the Vitest worker heap on Windows. This test instead asserts, via a
 * module-identity check, that noir's `PropertyDetails`/`About`/`Gallery`/`Contact` exports
 * are the exact same shared component references `classic` uses — proof of reuse, not a
 * fork, without paying the heap cost of a full render.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  DEFAULT_LAYOUT_THEME_ID,
  layoutThemeIds,
  loadLayoutTheme,
  resolveLayoutThemeId,
  themeRegistry,
} from "../registry";

// ---- Home.tsx's dependency surface ----
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
vi.mock("@/components/faq/FaqHighlights", () => ({
  __esModule: true,
  default: () => <div>FaqHighlights stub</div>,
}));
vi.mock("@/components/availability/SearchAvailabilityWidget", () => ({
  __esModule: true,
  SearchAvailabilityWidget: () => <div>SearchAvailabilityWidget stub</div>,
}));
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

describe("ADR-0081 D1/D2/D6/D8 — layout-theme registry contains noir with the curated matrix", () => {
  it("registers noir alongside classic and heritage with the expected metadata", () => {
    expect(layoutThemeIds).toContain("noir");
    expect(DEFAULT_LAYOUT_THEME_ID).toBe("classic"); // noir is opt-in premium, never the default
    expect(themeRegistry.noir.supportedColorPresets).toEqual(["privateIslandNoir", "emeraldDynasty"]);
    expect(themeRegistry.noir.defaultColorTokens).toBeDefined();
    expect(themeRegistry.noir.defaultColorTokens?.["--bg-primary"]).toBe("#0b0d12");
    expect(themeRegistry.noir.defaultColorTokens?.["--brand-primary"]).toBe("#d4af37");
  });

  it("resolveLayoutThemeId() accepts 'noir' as a recognized id (not a fallback to default)", () => {
    expect(resolveLayoutThemeId("noir")).toBe("noir");
  });

  it("loadLayoutTheme('noir') resolves a Home module genuinely different from classic's and heritage's", async () => {
    const classicModule = await loadLayoutTheme("classic");
    const heritageModule = await loadLayoutTheme("heritage");
    const noirModule = await loadLayoutTheme("noir");

    expect(noirModule.Home).not.toBe(classicModule.Home);
    expect(noirModule.Home).not.toBe(heritageModule.Home);

    // Reuse, not a fork: noir's PropertyDetails/About/Gallery/Contact are the exact same
    // shared component references classic uses (ADR-0081 D1 — never duplicate
    // booking/payment/listing-data logic into a theme package).
    expect(noirModule.PropertyDetails).toBe(classicModule.PropertyDetails);
    expect(noirModule.About).toBe(classicModule.About);
    expect(noirModule.Gallery).toBe(classicModule.Gallery);
    expect(noirModule.Contact).toBe(classicModule.Contact);
  });
});

describe("TASK-4906 — noir's Home renders the founder-specified full-bleed, minimal-chrome hero", () => {
  it("renders a single full-bleed hero photo with a dark scrim and the real search widget, no split editorial hero chrome", async () => {
    const { Home } = await loadLayoutTheme("noir");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("noir-home")).toBeInTheDocument();
    });
    expect(screen.getByTestId("noir-hero")).toBeInTheDocument();
    expect(screen.getByTestId("noir-hero-scrim")).toBeInTheDocument();
    expect(screen.getByText("SearchAvailabilityWidget stub")).toBeInTheDocument();
    // classic/heritage's "A note from your host" coral-redesign callout is not part of
    // noir's minimal-chrome composition.
    expect(screen.queryByText(/A note from your host/i)).not.toBeInTheDocument();
  });
});
