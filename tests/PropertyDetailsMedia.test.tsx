import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

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

vi.mock("@/data", () => ({
  propertyData: [
    {
      id: 101,
      property_name: "Test Property",
      property_location: "Test City",
      property_img: ["main.jpg", "thumb1.jpg", "thumb2.jpg", "thumb3.jpg", "thumb4.jpg", "thumb5.jpg"],
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
  propertyImages: { "101": ["main.jpg", "thumb1.jpg", "thumb2.jpg", "thumb3.jpg", "thumb4.jpg"] },
}));

vi.mock("@fancyapps/ui", () => ({
  Fancybox: {
    bind: vi.fn(),
    destroy: vi.fn(),
    show: vi.fn(),
  },
}));

import Homepage_PropertyDetails from "@/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails";

describe("Homepage_PropertyDetails gallery", () => {
  it.skip("lazy loads primary and thumbnail images", async () => {
    render(
      <MemoryRouter initialEntries={["/homes/atlas-homes-room-101/101"]}>
        <Homepage_PropertyDetails />
      </MemoryRouter>,
    );

    const mainImage = await screen.findByAltText(/Main property/i);
    expect(mainImage).toHaveAttribute("loading", "lazy");
    expect(mainImage).toHaveAttribute("decoding", "async");

    const thumbnails = await screen.findAllByAltText(/Thumbnail/i);
    thumbnails.forEach((thumbnail) => {
      expect(thumbnail).toHaveAttribute("loading", "lazy");
      expect(thumbnail).toHaveAttribute("decoding", "async");
    });
  });
});
