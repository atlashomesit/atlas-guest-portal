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

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

describe("Home", () => {
  it("renders default sections when all UX flags are disabled", async () => {
    render(
      <BookingProvider>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </BookingProvider>,
    );

    // BannerSecondary removed in Home v2 — replaced by inline why-direct section
    expect(screen.getByText(/We verify every home/i)).toBeInTheDocument();
    expect(screen.getByText(/You pay the host directly/i)).toBeInTheDocument();
    expect(screen.queryByText(/Free cancellation 48h before/i)).not.toBeInTheDocument();
    // 3cee54b3 (TASK-7822) moved these two behind React.lazy + <Suspense fallback={null}>, so
    // they are absent on the first synchronous paint and only appear once the dynamic import
    // resolves. getByText asserts against the fallback and always fails — await them.
    //
    // TASK-101855: instrumentation only, NOT a timeout change (do not widen findByText's default
    // 1000ms window here — see the board block for why). gate-run-20260909T021634 reproduced
    // exactly here at 2851ms in STEP 1's parallel window (guest vitest concurrent with the API
    // build) but the same assertion passed 468ms alone and did not reproduce across 6 isolated
    // retries + 1 synthetic-CPU-load retry + ~22 further retries under a REAL concurrent
    // `dotnet build`/`dotnet test Atlas.Api.Tests` in this task's own investigation (range
    // 107ms-1057ms, 0 failures). Timing every occurrence, pass or fail, so the NEXT gate red
    // carries the actual lazy-import resolution number instead of only a pass/fail bit — this is
    // what settles whether the concurrency hypothesis is the true cause.
    const servicesStart = performance.now();
    expect(await screen.findByText(/Discover Our Exclusive Services/i)).toBeInTheDocument();
    console.info(
      `[TASK-101855] ServicesSection findByText resolved in ${(performance.now() - servicesStart).toFixed(0)}ms`,
    );

    const testimonialsStart = performance.now();
    expect(await screen.findByText(/Hear What Our Happy Guests Are Saying/i)).toBeInTheDocument();
    console.info(
      `[TASK-101855] TestimonialsSection findByText resolved in ${(performance.now() - testimonialsStart).toFixed(0)}ms`,
    );
  });
});
