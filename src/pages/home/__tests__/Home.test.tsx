import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { BookingProvider } from "../../../contexts/BookingContext";
import Home from "../Home";

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

vi.mock("../../../components/home/BannerSecondary", () => ({
  __esModule: true,
  default: () => <div>Atlas Homes – Where Every Stay Feels Like Home</div>,
}));

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

describe("Home", () => {
  it("renders default sections when all UX flags are disabled", () => {
    render(
      <BookingProvider>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </BookingProvider>,
    );

    expect(screen.getByText(/Atlas Homes – Where Every Stay Feels Like Home/i)).toBeInTheDocument();
    expect(screen.getByText(/Discover Our Exclusive Services/i)).toBeInTheDocument();
    expect(screen.getByText(/Hear What Our Happy Guests Are Saying/i)).toBeInTheDocument();
  });
});
