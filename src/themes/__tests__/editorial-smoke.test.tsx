/**
 * TASK-4924 / ADR-0081 D8 — gate smoke + registry proof for the "editorial" ("editorial
 * magazine") layout theme, mirroring the AC7/noir/coastal test pattern already established
 * (`ac7-layout-theme-switch.test.tsx` TASK-4914, `noir-layout-theme.test.tsx` TASK-4906,
 * `coastal-smoke.test.tsx` TASK-4907): registry metadata, `resolveLayoutThemeId` recognition,
 * module-identity divergence/reuse, and a full render of `Home` (the page this layout's
 * founder-specified brief actually diverges on) — asserting the booking/payment entry point
 * (the hero-mounted search widget) remains reachable despite the narrative composition, per
 * this task's own stop-and-ask.
 *
 * `PropertyDetails` is NOT re-rendered here (matches this repo's own documented constraint,
 * `vitest.config.ts`'s heap-exhaustion note for `Homepage_PropertyDetails` full renders on
 * Windows) — since `editorial` reuses the identical, unforked `classic` component for that
 * page (verified by identity check below, not a source diff, because there is no fork to
 * diff), no additional render-cost risk is introduced by this layout at all. Full-page
 * coverage lives in Playwright (TASK-4908's per-layout smoke spec), same convention as every
 * other layout.
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

// ---- Home.tsx's dependency surface ----
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

describe("ADR-0081 D8 — layout-theme registry contains editorial with the founder-specified curated matrix", () => {
  it("registers editorial alongside classic/heritage/noir/coastal with the expected metadata", () => {
    expect(layoutThemeIds).toContain("editorial");
    expect(themeRegistry.editorial.supportedColorPresets).toEqual([
      "loversRetreatBlush",
      "auroraChampagne",
      "jetsetPearl",
    ]);
    expect(themeRegistry.editorial.defaultColorTokens).toBeDefined();
    expect(themeRegistry.editorial.defaultColorTokens?.["--bg-primary"]).toBe("#faf6f0");
    expect(themeRegistry.editorial.defaultColorTokens?.["--text-primary"]).toBe("#1f1b16");
  });

  it("resolveLayoutThemeId() accepts 'editorial' as a recognized id (not a fallback to default)", () => {
    expect(resolveLayoutThemeId("editorial")).toBe("editorial");
  });

  it("loadLayoutTheme('editorial') resolves a Home module genuinely different from every sibling layout's, but reuses classic's PropertyDetails/About/Gallery/Contact unchanged (no fork)", async () => {
    const classicModule = await loadLayoutTheme("classic");
    const noirModule = await loadLayoutTheme("noir");
    const coastalModule = await loadLayoutTheme("coastal");
    const editorialModule = await loadLayoutTheme("editorial");

    expect(editorialModule.Home).not.toBe(classicModule.Home);
    expect(editorialModule.Home).not.toBe(noirModule.Home);
    expect(editorialModule.Home).not.toBe(coastalModule.Home);

    // Reuse, not a fork: editorial's PropertyDetails/About/Gallery/Contact are the exact same
    // shared component references classic uses (ADR-0081 D1 — never duplicate
    // booking/payment/listing-data logic into a theme package).
    expect(editorialModule.PropertyDetails).toBe(classicModule.PropertyDetails);
    expect(editorialModule.About).toBe(classicModule.About);
    expect(editorialModule.Gallery).toBe(classicModule.Gallery);
    expect(editorialModule.Contact).toBe(classicModule.Contact);
  });
});

describe("AC5/AC13 — editorial's Home renders the founder-specified text-forward, story-driven composition, booking entry point reachable", () => {
  it("renders the masthead hero, the real search widget (booking entry point), the pull-quote callout, and the story-flow featured stays — no card-grid composition", async () => {
    const { Home } = await loadLayoutTheme("editorial");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("editorial-home")).toBeInTheDocument();
    });

    // Text-led masthead hero, inset (not full-bleed) media panel.
    expect(screen.getByTestId("editorial-hero")).toBeInTheDocument();
    expect(screen.getByTestId("editorial-hero-media")).toBeInTheDocument();

    // Booking entry point mounted directly in the hero, unambiguous regardless of the
    // narrative composition around it (this task's own stop-and-ask).
    expect(screen.getByTestId("hero-widget")).toBeInTheDocument();
    expect(screen.getByText("SearchAvailabilityWidget stub")).toBeInTheDocument();

    // Pull-quote-style callout — the founder-specified "pull-quote-style callouts".
    expect(screen.getByTestId("editorial-pull-quote")).toBeInTheDocument();
    expect(
      screen.getByText(/Book direct.*host keeps more/i),
    ).toBeInTheDocument();

    // Story-flow featured stays — the layout's largest structural divergence (vertical,
    // alternating feature spreads, not a grid or carousel).
    expect(screen.getByTestId("editorial-featured-stays")).toBeInTheDocument();
    // getListingDisplayName() maps property id 202 -> "Suite 202" (SKU/floor-id display-name
    // mapping, src/lib/listingDisplayName.ts) — same mapping every other layout's listings
    // section already goes through, not something this section invents.
    expect(screen.getByText("Suite 202")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /available to book/i })).toBeInTheDocument();

    // classic's/coastal's grid-only `HomePage_Locations` composition (heading id="our-homes")
    // is not part of this layout at all — editorial never imports it, using
    // `EditorialFeaturedStays`'s vertical story-flow instead.
    expect(document.getElementById("our-homes")).not.toBeInTheDocument();
  });
});
