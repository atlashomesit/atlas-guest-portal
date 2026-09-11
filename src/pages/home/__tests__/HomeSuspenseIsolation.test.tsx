import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { BookingProvider } from "../../../contexts/BookingContext";
import Home from "../Home";

vi.mock("../../../tenant/tenantContext", () => ({
  getTenantContext: vi.fn(() => ({ slug: "atlas", isMarketplaceRoot: true })),
}));

vi.mock("../../../components/homepage_components/slider/Slider", () => ({
  __esModule: true,
  default: () => <div>Hero Slider</div>,
}));

vi.mock("../../../components/homepage_components/homepage_locations/HomePage_Locations", () => ({
  __esModule: true,
  default: () => <div>Home Locations</div>,
}));

vi.mock("../../../components/home/ServicesSection", () => ({
  __esModule: true,
  default: () => <div>Discover Our Exclusive Services</div>,
}));

vi.mock("../../../components/home/TestimonialsSection", () => ({
  __esModule: true,
  default: () => <div>Hear What Our Happy Guests Are Saying</div>,
}));

// TASK-101858. Home.tsx used to wrap all four React.lazy sections in ONE shared
// <Suspense>: an all-or-nothing boundary, so the slowest chunk held every sibling
// blank. This stub never resolves its chunk — it suspends forever, the way a
// stalled network fetch suspends a lazy import in a real browser — pinning the
// per-section boundary fix: with one shared boundary this test reds (both
// assertions time out); with a boundary per section it greens.
vi.mock("../../../components/faq/FaqHighlights", () => ({
  __esModule: true,
  default: () => {
    throw new Promise(() => {});
  },
}));

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

describe("Home per-section Suspense (TASK-101858)", () => {
  it("renders sibling lazy sections while one chunk is still suspended", async () => {
    render(
      <BookingProvider>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </BookingProvider>,
    );

    // FaqHighlights is suspended forever above; these siblings must still paint.
    // (FooterCtaStrip needs no stub: enableFooterMiniCtaAboveFooter is false,
    // so it never mounts.)
    expect(
      await screen.findByText(/Discover Our Exclusive Services/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Hear What Our Happy Guests Are Saying/i),
    ).toBeInTheDocument();
  });
});
