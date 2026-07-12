/**
 * TASK-4492 Investigation Note (2026-07-12):
 *
 * STATUS: WhyChooseSection.tsx and BannerSecondary.tsx are NOT imported or rendered by the live Home.tsx.
 * Only this test file (tests/HomepageUxWrappers.test.tsx, outside src/) renders them directly.
 *
 * FINDINGS:
 * - Home.tsx imports: ServicesSection ✓, TestimonialsSection ✓
 * - Home.tsx does NOT import: WhyChooseSection ✗, BannerSecondary ✗
 * - Home.tsx renders an inline WHY_DIRECT_ITEMS 3-pillar strip (lines 287-316) which may have replaced WhyChooseSection
 * - BannerSecondary is completely absent from Home.tsx
 * - Both unreferenced components are still in the codebase and fully functional
 * - The test asserts specific copy ("shows the established Why Choose experience", "not... accordion layout")
 *   implying these components were once live on the homepage
 *
 * DECISION NEEDED (Founder question):
 * Case (a): Were these sections intentionally dropped from the homepage in a past redesign?
 *           → Action: Delete WhyChooseSection.tsx, BannerSecondary.tsx, and this entire test file
 * Case (b): Did a refactor silently drop these from the homepage?
 *           → Action: Restore imports and rendering in Home.tsx, keep test as regression guard
 *
 * Current decision: HOLD — do NOT delete without founder approval per TASK-4492 guardrail.
 */

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

    // RA-006 §3.6: with no tenant resolved in the test, BannerSecondary uses marketplace display brand.
    expect(screen.getByTestId("parallax-title").textContent).toMatch(/Atlastays|Our Homestays/i);
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
