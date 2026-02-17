/**
 * Smoke test: Property details route must render without ReferenceError.
 * Catches regressions like "unitSlug is not defined" that only surface on
 * deep-linked prod routes.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Homepage_PropertyDetails from "@/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails";

vi.mock("@/components/availability/UnitBookingWidget", () => ({
  __esModule: true,
  default: () => <div>Booking Widget</div>,
}));

vi.mock("@/utils/analytics", () => ({ trackEvent: vi.fn() }));

vi.mock("@/utils/pricing", () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 1000 })),
  inferUnitType: vi.fn(() => "1bhk"),
}));

vi.mock("@/config/policyConfig", () => ({
  getUnitPolicy: () => ({ checkIn: "2:00 PM", checkOut: "11:00 AM" }),
}));

vi.mock("@/content/terms", () => ({
  inlinePolicySnippets: { cancellation: "Flexible", houseRules: "Be kind" },
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

const mockProperties = [
  {
    id: 202,
    listingId: 4,
    property_name: "Atlas Homes Room 202",
    property_location: "Hyderabad",
    property_img: ["img1.jpg"],
    property_amenities: [{ amenities_icon: "wifi" }],
    property_description: "Test",
    property_nearplaces: [],
    property_mapSrc: "https://maps.example.com",
    property_policy_details: [],
    property_rating: 4.5,
    property_reviews: 10,
    property_review_snippets: [],
    property_price: 2999,
  },
  {
    id: 301,
    listingId: 5,
    property_name: "Atlas Homes Room 301",
    property_location: "Hyderabad",
    property_img: ["img1.jpg"],
    property_amenities: [{ amenities_icon: "wifi" }],
    property_description: "Test",
    property_nearplaces: [],
    property_mapSrc: "https://maps.example.com",
    property_policy_details: [],
    property_rating: 4.5,
    property_reviews: 10,
    property_review_snippets: [],
    property_price: 2999,
  },
];

vi.mock("@/data", () => ({
  propertyData: mockProperties,
  propertyImages: { "202": ["img1.jpg"], "301": ["img1.jpg"] },
}));

vi.mock("@/utils/listingResolver", () => ({
  resolveListing: vi.fn().mockResolvedValue({
    id: 4,
    propertyId: 1,
    name: "Atlas202",
  }),
}));

vi.mock("@fancyapps/ui", () => ({
  Fancybox: { bind: vi.fn(), destroy: vi.fn(), show: vi.fn() },
}));

describe("PropertyDetails route smoke", () => {
  it("renders without ReferenceError on deep-link /homes/atlas-homes-room-202/4", async () => {
    render(
      <MemoryRouter initialEntries={["/homes/atlas-homes-room-202/4"]}>
        <Routes>
          <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/We couldn't load this page/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Atlas Homes Room 202/i)).toBeInTheDocument();
  });

  it("renders without ReferenceError on deep-link /homes/atlas-homes-room-301/5", async () => {
    render(
      <MemoryRouter initialEntries={["/homes/atlas-homes-room-301/5"]}>
        <Routes>
          <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/We couldn't load this page/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Atlas Homes Room 301/i)).toBeInTheDocument();
  });
});
