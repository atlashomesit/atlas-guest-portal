import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { BookingProvider } from "@/contexts/BookingContext";
import type { PublicListing } from "@/api/listingClient";

vi.mock("@/api/listingClient", () => ({
  fetchPublicListings: vi.fn(),
}));
vi.mock("@/api/client", () => ({ buildApiUrl: (p: string) => `https://api.test${p}` }));

import { fetchPublicListings } from "@/api/listingClient";
import { _resetTenantResolutionForTests, setMarketplaceMode } from "@/tenant/tenantResolver";
import CityLandingPage from "./CityLandingPage";

const goaListing = {
  id: 501,
  maxGuests: 4,
  propertyName: "Atlas Coastal Villa",
  propertyAddress: "Near Calangute Beach, North Goa, India",
  name: "Garden-view room",
  baseNightlyRate: 4500,
  photoUrls: [] as string[],
  coverPhotoUrl: null as string | null,
  propertyRating: 4.8,
  reviewCount: 12,
  wifiSpeedMbps: 40,
} satisfies PublicListing;

describe("CityLandingPage", () => {
  beforeEach(() => {
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

    expect(
      await screen.findByRole("heading", { level: 1, name: /Homestays in Goa/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("city-landing-listings")).toBeInTheDocument();
    });

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

      expect(
        await screen.findByRole("heading", { level: 1, name: /Homestays in Goa/i }),
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("city-landing-listings")).toBeInTheDocument();
      });

      expect(screen.getByText(/Calangute Beach Villa/i)).toBeInTheDocument();
      // The tenant-scoped path must never be used on the marketplace host.
      expect(fetchPublicListings).not.toHaveBeenCalled();
    });
  });
});
