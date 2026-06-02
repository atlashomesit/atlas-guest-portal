import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/homepage_components/homepage_exclusiveservice/Homepage_ExclusiveService", () => ({
  default: () => <div data-testid="exclusive-service">Exclusive services baseline</div>,
}));

vi.mock("../src/components/homepage_components/homepage_whychoose/Homepage_WhyChoose", () => ({
  default: () => <div data-testid="why-choose-default">Why Choose baseline</div>,
}));

vi.mock("../src/hooks/useTenantListings", () => ({
  useTenantListings: () => ({
    properties: [{ id: 1, listingId: 101 }],
    listings: [],
    state: "success" as const,
    errorMessage: undefined,
    refetch: vi.fn(),
  }),
}));

vi.mock("../src/hooks/useVerifiedReviews", () => ({
  useVerifiedReviews: () => ({
    reviews: [
      {
        id: 1,
        firstName: "Ananya",
        rating: 5,
        text: "Spotless rooms and warm hosts.",
        createdAt: "2026-05-01T00:00:00Z",
      },
    ],
    loading: false,
  }),
}));

vi.mock("../src/components/commonComponents/parallax/Parallax", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="parallax">
      <h2 data-testid="parallax-title">{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock("../src/config/homepageUxFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config/homepageUxFlags")>();
  return {
    ...actual,
    enableServicesConcreteCopy: false,
    enableServicesIconography: false,
    enableServicesOneLineDescriptions: false,
    enableServicesAlternatingBackgrounds: false,
  };
});

import { BookingProvider } from "../src/contexts/BookingContext";
import BannerSecondary from "../src/components/home/BannerSecondary";
import ServicesSection from "../src/components/home/ServicesSection";
import WhyChooseSection from "../src/components/home/WhyChooseSection";
import TestimonialsSection from "../src/components/home/TestimonialsSection";

const withBooking = (node: React.ReactElement) => <BookingProvider>{node}</BookingProvider>;

describe("Homepage UX wrappers (default path)", () => {
  it("renders the default secondary banner when flags are off", () => {
    const { asFragment } = render(withBooking(<BannerSecondary />));

    // RA-006 §3.6: with no tenant resolved in the test, BannerSecondary falls back to a
    // brand-neutral "Our Homestays" instead of "Atlas Homes" so unrecognised tenants
    // don't leak Atlas brand on a cold load.
    expect(screen.getByTestId("parallax-title").textContent).toContain("Our Homestays");
    expect(screen.queryByText(/value-block variant/i)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it("keeps services on the production path without placeholders", () => {
    const { asFragment } = render(withBooking(<ServicesSection />));

    expect(screen.getByTestId("exclusive-service")).toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it("shows the established Why Choose experience", () => {
    const { asFragment } = render(withBooking(<WhyChooseSection />));

    expect(screen.getByTestId("why-choose-default")).toBeInTheDocument();
    expect(screen.queryByText(/accordion layout/i)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  it("uses verified guest reviews instead of placeholders", () => {
    const { asFragment } = render(withBooking(<TestimonialsSection />));

    expect(screen.getByText("What verified guests say")).toBeInTheDocument();
    expect(screen.getByText("Verified stay")).toBeInTheDocument();
    expect(screen.queryByText(/Source pending verification/i)).not.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
