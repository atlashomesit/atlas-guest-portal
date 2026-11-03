import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { BookingProvider } from "@/contexts/BookingContext";
import type { PublicListing } from "@/api/listingClient";

vi.mock("@/api/listingClient", () => ({
  fetchPublicListings: vi.fn(),
}));
// ListingCard reads the tenant processing fee (GUEST-003), which sends the tenant headers.
vi.mock("@/api/client", () => ({ buildApiUrl: (p: string) => `https://api.test${p}`, getApiHeaders: () => ({}) }));

import { fetchPublicListings } from "@/api/listingClient";
import { _resetTenantResolutionForTests, setMarketplaceMode } from "@/tenant/tenantResolver";
import CityLandingPage from "./CityLandingPage";
import { settle } from "../test/settle";

const goaListing = {
  id: 501,
  maxGuests: 4,
  propertyName: "Atlas Coastal Villa",
  propertyAddress: "Near Calangute Beach, North Goa, India",
  name: "Garden-view room",
  displayName: "Garden-view room",
  baseNightlyRate: 4500,
  photoUrls: [] as string[],
  coverPhotoUrl: null as string | null,
  propertyRating: 4.8,
  reviewCount: 12,
  wifiSpeedMbps: 40,
} satisfies PublicListing;

describe("CityLandingPage", () => {
  beforeEach(() => {
    _resetTenantResolutionForTests();
    vi.mocked(fetchPublicListings).mockReset();
  });

  it("renders Goa H1 and listing grid when public API returns a matching address", async () => {
    vi.mocked(fetchPublicListings).mockResolvedValue([goaListing]);

    render(
      <MemoryRouter>
        <CurrencyProvider>
          <BookingProvider>
            <CityLandingPage citySlug="goa" />
          </BookingProvider>
        </CurrencyProvider>
      </MemoryRouter>,
    );

    await settle();
    expect(
      screen.getByRole("heading", { level: 1, name: /Homestays in Goa/i }),
    ).toBeInTheDocument();

    await settle();
    expect(screen.getByTestId("city-landing-listings")).toBeInTheDocument();

    expect(screen.getByText(/Garden-view room/i)).toBeInTheDocument();
    expect(fetchPublicListings).toHaveBeenCalledTimes(1);
  });

  // MKT-004: on the marketplace host, the page must source cross-tenant GET /marketplace/listings
  // (paged to the end) instead of the tenant-scoped /listings/public — before this fix the
  // marketplace apex always resolved tenant "atlas" and never saw another tenant's inventory.
  describe("marketplace host", () => {
    afterEach(() => {
      _resetTenantResolutionForTests();
      vi.unstubAllGlobals();
    });

    it("renders a non-atlas Goa listing from a mocked /marketplace/listings payload", async () => {
      setMarketplaceMode(true);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          const u = String(url);
          if (u.includes("/marketplace/listings")) {
            return {
              ok: true,
              json: async () => ({
                items: [
                  {
                    id: 723,
                    tenantSlug: "sahil-goyal",
                    title: "Calangute Beach Villa",
                    city: "Goa",
                    pricePerNight: 5200,
                    maxGuests: 6,
                  },
                ],
                total: 1,
              }),
            } as unknown as Response;
          }
          return { ok: false, json: async () => ({}) } as unknown as Response;
        }),
      );

      render(
        <MemoryRouter>
          <CurrencyProvider>
            <BookingProvider>
              <CityLandingPage citySlug="goa" />
            </BookingProvider>
          </CurrencyProvider>
        </MemoryRouter>,
      );

      await settle();
      expect(
        screen.getByRole("heading", { level: 1, name: /Homestays in Goa/i }),
      ).toBeInTheDocument();

      await settle();
      expect(screen.getByTestId("city-landing-listings")).toBeInTheDocument();

      expect(screen.getByText(/Calangute Beach Villa/i)).toBeInTheDocument();
      // The tenant-scoped path must never be used on the marketplace host.
      expect(fetchPublicListings).not.toHaveBeenCalled();
    });

    it("MKT-042: forwards accommodationType, amenityCodes, isGstRegistered, fee flags, and preserves brand/utm params on card hrefs", async () => {
      setMarketplaceMode(true);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          const u = String(url);
          if (u.includes("/marketplace/listings")) {
            return {
              ok: true,
              json: async () => ({
                items: [
                  {
                    id: 724,
                    tenantSlug: "sahil-goyal",
                    title: "Anjuna Hostel Dorm",
                    city: "Goa",
                    pricePerNight: 1000,
                    maxGuests: 6,
                    rating: 4.9,
                    reviewCount: 8,
                    accommodationType: "HostelDorm",
                    amenityCodes: ["wifi", "free_parking"],
                    isGstRegistered: false,
                    chargesOnlinePaymentFee: false,
                    convenienceFeePercent: 2.5,
                  },
                ],
                total: 1,
              }),
            } as unknown as Response;
          }
          return { ok: false, json: async () => ({}) } as unknown as Response;
        }),
      );

      render(
        <MemoryRouter initialEntries={["/homestays-in-goa?brand=atlastays&utm_source=google&utm_campaign=summer"]}>
          <CurrencyProvider>
            <BookingProvider>
              <CityLandingPage citySlug="goa" />
            </BookingProvider>
          </CurrencyProvider>
        </MemoryRouter>,
      );

      await settle();
      const section = screen.getByTestId("city-landing-listings");
      // Dorm badge and per-bed indicator rendered via forwarded accommodationType="HostelDorm"
      expect(screen.getByTestId("hostel-dorm-base-badge")).toBeInTheDocument();
      // Amenity labels rendered via forwarded amenityCodes
      expect(section.textContent).toMatch(/Free Parking/i);
      // Unregistered host (isGstRegistered=false, chargesOnlinePaymentFee=false) -> Est. ₹1,000 total (no 5% GST, no 3% fee)
      expect(section.textContent).toContain("₹1,000 est. total");

      const roomLink = screen.getByRole("link", { name: /View room Anjuna Hostel Dorm/i });
      const href = roomLink.getAttribute("href") ?? "";
      expect(href).toContain("/homes/anjuna-hostel-dorm/724?");
      expect(href).toContain("tenant=sahil-goyal");
      expect(href).toContain("brand=atlastays");
      expect(href).toContain("utm_source=google");
      expect(href).toContain("utm_campaign=summer");

      // Rating chip link uses the card's cross-tenant href + #reviews
      const reviewsLink = screen.getByRole("link", { name: "View guest reviews" });
      expect(reviewsLink.getAttribute("href")).toBe(`${href}#reviews`);
    });
  });

  // MKT-014: cards on a city landing page are now real `<a href>` anchors, not nested buttons
  // calling navigate() — so non-JS crawlers can follow a city page to its homes. The href must
  // mirror the marketplace card helper's path (MKT-004 cross-tenant `?tenant=` carry).
  it("MKT-014: city-page cards render as crawlable anchors to /homes/... paths", async () => {
    vi.mocked(fetchPublicListings).mockResolvedValue([goaListing]);

    render(
      <MemoryRouter>
        <CurrencyProvider>
          <BookingProvider>
            <CityLandingPage citySlug="goa" />
          </BookingProvider>
        </CurrencyProvider>
      </MemoryRouter>,
    );

    await settle();
    const section = screen.getByTestId("city-landing-listings");
    const anchors = section.querySelectorAll("a[href*='/homes/']");
    expect(anchors.length, "city-page card container must contain at least one /homes/ anchor").toBeGreaterThan(0);
    // Same-tenant city page (not marketplace) — no ?tenant= hint needed.
    expect(anchors[0].getAttribute("href")).toMatch(/\/homes\/atlas-coastal-villa\/501$/);
    // MKT-042: rating chip on city-page cards follows the card's /homes/... href + #reviews.
    const reviewsLink = screen.getByRole("link", { name: "View guest reviews" });
    expect(reviewsLink.getAttribute("href")).toBe("/homes/atlas-coastal-villa/501#reviews");
  });
});
