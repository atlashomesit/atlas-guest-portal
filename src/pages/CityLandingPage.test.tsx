import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { BookingProvider } from "@/contexts/BookingContext";
import type { PublicListing } from "@/api/listingClient";

vi.mock("@/api/listingClient", () => ({
  fetchPublicListings: vi.fn(),
}));

import { fetchPublicListings } from "@/api/listingClient";
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
});
