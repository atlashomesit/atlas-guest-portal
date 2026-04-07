import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Slider from "@/components/homepage_components/slider/Slider";
import { BookingProvider } from "@/contexts/BookingContext";
import * as analytics from "@/utils/analytics";

vi.mock("@/utils/analytics", () => ({
  trackEvent: vi.fn(),
  resetAnalyticsTransport: vi.fn(),
}));

describe("availability search flow", () => {
  beforeEach(() => {
    (window as typeof window & { __ATLAS_RUNTIME_CONFIG__?: { apiBaseUrl?: string } }).__ATLAS_RUNTIME_CONFIG__ = {
      apiBaseUrl: "https://api.example.com",
    };
  });

  afterEach(() => {
    analytics.resetAnalyticsTransport();
  });

  it("renders hero widget with check availability control", () => {
    render(
      <MemoryRouter>
        <BookingProvider>
          <Slider />
        </BookingProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("hero-widget")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
  });
});
