import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

vi.mock("@/components/availability/UnitBookingWidget", () => ({
  __esModule: true,
  default: () => <div>Booking Widget</div>,
}));

vi.mock("@/components/homepage_components/hotelBooking_form/BookingCard.tsx", () => ({
  __esModule: true,
  default: () => <div id="booking-form">Booking Form</div>,
}));

vi.mock("@/utils/analytics", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/utils/pricing", () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 1000 })),
  inferUnitType: vi.fn(() => "test-unit"),
}));

vi.mock("@/config/policyConfig", () => ({
  getUnitPolicy: () => ({ checkIn: "2:00 PM", checkOut: "11:00 AM" }),
}));

vi.mock("@/content/terms", () => ({
  inlinePolicySnippets: { cancellation: "Flexible cancellation", houseRules: "Be kind" },
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

vi.mock("@/utils/listingResolver", () => ({
  resolveListing: vi.fn().mockResolvedValue({
    id: 101,
    propertyId: 1,
    name: "Test Property",
  }),
}));

vi.mock("@/data", () => ({
  propertyData: [
    {
      id: 101,
      listingId: 101,
      property_name: "Test Property",
      property_location: "Test City",
      property_img: [
        "https://cdn.example.com/photo1.jpg",
        "https://cdn.example.com/photo2.jpg",
        "https://cdn.example.com/photo3.jpg",
      ],
      property_amenities: [{ amenities_icon: "wifi" }],
      property_description: "A cozy place to stay.",
      property_nearplaces: ["Place One"],
      property_mapSrc: "https://maps.example.com",
      property_policy_details: [],
      property_rating: 4.7,
      property_reviews: 12,
      property_review_snippets: ["Great stay"],
      property_price: 1000,
    },
  ],
}));

vi.mock("@fancyapps/ui", () => ({
  Fancybox: {
    bind: vi.fn(),
    destroy: vi.fn(),
    show: vi.fn(),
  },
}));

vi.mock("@/hooks/useTenantListings", () => ({
  useTenantListings: () => ({
    listings: [],
    properties: [
      {
        id: 101,
        listingId: 101,
        property_name: "Test Property",
        property_location: "Test City",
        property_img: [
          "https://cdn.example.com/photo1.jpg",
          "https://cdn.example.com/photo2.jpg",
          "https://cdn.example.com/photo3.jpg",
        ],
        property_amenities: [{ amenities_icon: "wifi" }],
        property_description: "A cozy place to stay.",
        property_rating: 4.7,
        property_reviews: 12,
        property_price: 1000,
      },
    ],
    state: "success" as const,
    refetch: vi.fn(),
  }),
}));

import Homepage_PropertyDetails from "@/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails";

describe("Homepage_PropertyDetails gallery", () => {
  it("renders property details component", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/homes/test-property/101"]}>
        <Routes>
          <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    // Verify component renders with property title
    await screen.findByText("Test Property");
    expect(container).toBeTruthy();
  });

  it.skip("lazy loads primary and thumbnail images", async () => {
    render(
      <MemoryRouter initialEntries={["/homes/test-property/101"]}>
        <Routes>
          <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
        </Routes>
      </MemoryRouter>,
    );

    // Find all images with alt text containing "photo"
    const allImages = await screen.findAllByAltText(/photo/i, {}, { timeout: 3000 });
    expect(allImages.length).toBeGreaterThanOrEqual(1);

    // Check that all images have lazy loading attributes
    allImages.forEach((img) => {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).toHaveAttribute("decoding", "async");
    });
  });
});
