/**
 * TASK-4925 / ADR-0081 D8 — gate smoke + registry proof for the "photoFirst" ("minimal
 * photo-first") layout theme, mirroring the AC7/noir/coastal test pattern already established
 * (`ac7-layout-theme-switch.test.tsx` TASK-4914, `noir-layout-theme.test.tsx` TASK-4906,
 * `coastal-smoke.test.tsx` TASK-4907): registry metadata, `resolveLayoutThemeId` recognition,
 * module-identity divergence/reuse, and a full render of `Home` (the one page this layout's
 * founder-specified brief actually diverges on).
 *
 * `PropertyDetails` is NOT re-rendered here (matches this repo's own documented constraint,
 * `vitest.config.ts`'s `heavyRouteSmokes` exclusion for `Homepage_PropertyDetails` — full
 * render exhausts the Vitest worker heap on Windows) — since `photoFirst` reuses the identical,
 * unforked `classic` component for that page (verified by identity check below, not a source
 * diff), no additional render-cost risk is introduced by this layout at all. Full-page
 * coverage lives in Playwright (TASK-4908's per-layout smoke spec), same convention as every
 * other layout.
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

// ---- Home.tsx's dependency surface (shared by classic/heritage/noir/coastal/photoFirst Home) ----
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

describe("ADR-0081 D1/D2/D6/D8 — layout-theme registry contains photoFirst with the curated matrix", () => {
  it("registers photoFirst alongside classic/heritage/noir/coastal with the expected metadata", () => {
    expect(layoutThemeIds).toContain("photoFirst");
    expect(DEFAULT_LAYOUT_THEME_ID).toBe("classic"); // photoFirst is opt-in premium, never the default
    expect(themeRegistry.photoFirst.supportedColorPresets).toEqual(["oceanLuxury", "royalViolet"]);
    expect(themeRegistry.photoFirst.defaultColorTokens).toBeDefined();
    expect(themeRegistry.photoFirst.defaultColorTokens?.["--bg-primary"]).toBe("#ffffff");
    expect(themeRegistry.photoFirst.defaultColorTokens?.["--text-primary"]).toBe("#111111");
  });

  it("resolveLayoutThemeId() accepts 'photoFirst' as a recognized id (not a fallback to default)", () => {
    expect(resolveLayoutThemeId("photoFirst")).toBe("photoFirst");
  });

  it("loadLayoutTheme('photoFirst') resolves a Home module genuinely different from classic's/heritage's/noir's/coastal's, but reuses classic's PropertyDetails/About/Gallery/Contact unchanged (no fork)", async () => {
    const classicModule = await loadLayoutTheme("classic");
    const heritageModule = await loadLayoutTheme("heritage");
    const noirModule = await loadLayoutTheme("noir");
    const coastalModule = await loadLayoutTheme("coastal");
    const photoFirstModule = await loadLayoutTheme("photoFirst");

    expect(photoFirstModule.Home).not.toBe(classicModule.Home);
    expect(photoFirstModule.Home).not.toBe(heritageModule.Home);
    expect(photoFirstModule.Home).not.toBe(noirModule.Home);
    expect(photoFirstModule.Home).not.toBe(coastalModule.Home);

    // Reuse, not a fork: photoFirst's PropertyDetails/About/Gallery/Contact are the exact same
    // shared component references classic uses (ADR-0081 D1 — never duplicate
    // booking/payment/listing-data logic into a theme package).
    expect(photoFirstModule.PropertyDetails).toBe(classicModule.PropertyDetails);
    expect(photoFirstModule.About).toBe(classicModule.About);
    expect(photoFirstModule.Gallery).toBe(classicModule.Gallery);
    expect(photoFirstModule.Contact).toBe(classicModule.Contact);
  });
});

describe("TASK-4925 — photoFirst's Home renders the founder-specified near-zero-chrome, full-bleed hero, plus the persistent sticky booking bar", () => {
  it("renders a single full-bleed hero photo with a scrim, no eyebrow badge, and no inline booking widget in the hero", async () => {
    const { Home } = await loadLayoutTheme("photoFirst");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("photofirst-home")).toBeInTheDocument();
    });
    expect(screen.getByTestId("photofirst-hero")).toBeInTheDocument();
    expect(screen.getByTestId("photofirst-hero-scrim")).toBeInTheDocument();
    // noir's eyebrow badge / glass hero-widget card are not part of photoFirst's near-zero-chrome
    // brief — the booking widget lives in the sticky bar, not the hero.
    expect(screen.queryByTestId("hero-widget")).not.toBeInTheDocument();
  });

  it("renders the full-bleed listings stack (huge photography as primary content, not a card grid)", async () => {
    const { Home } = await loadLayoutTheme("photoFirst");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("photofirst-listings-stack")).toBeInTheDocument();
    });
    expect(screen.getByTestId("photofirst-stack-frame")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /available to book/i })).toBeInTheDocument();
    // getListingDisplayName() maps property id 202 -> "Suite 202" (SKU/floor-id display-name
    // mapping, src/lib/listingDisplayName.ts) — same mapping every other layout's listings
    // section already goes through, not something this stack invents.
    expect(screen.getByText("Suite 202")).toBeInTheDocument();
  });

  it("renders the sticky booking bar with the real SearchAvailabilityWidget — the booking entry point (AC5/AC13) — pinned outside the hero", async () => {
    const { Home } = await loadLayoutTheme("photoFirst");
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("photofirst-sticky-booking-bar")).toBeInTheDocument();
    });
    expect(screen.getByText("SearchAvailabilityWidget stub")).toBeInTheDocument();
    // The widget's mount point keeps the shared `id="search-form"` anchor id every other
    // layout's hero widget already uses, so the shared "scroll to booking" behavior still works.
    expect(document.getElementById("search-form")).toBeInTheDocument();
  });
});
