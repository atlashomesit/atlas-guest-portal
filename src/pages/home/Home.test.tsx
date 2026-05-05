import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../utils/analytics")>("../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

vi.mock("../../api/listingClient", () => ({
  fetchPublicListings: vi.fn(() => Promise.resolve([])),
}));

import Home from "./Home";
import { BookingProvider } from "../../contexts/BookingContext";

describe("Homepage layout", () => {
  it("exposes the Our Homes anchor for in-page navigation", { timeout: 30000 }, () => {
    render(
      <MemoryRouter>
        <BookingProvider>
          <Home />
        </BookingProvider>
      </MemoryRouter>,
    );

    // Use exact match: substring /our homes/ also matches the WhyChooseSection's
    // "Why choose Our Homestays" fallback when the tenant context is unresolved (RA-006 §3.6).
    const ourHomesSection = screen.getByRole("heading", { name: /^our homes$/i }).closest("section");
    expect(ourHomesSection).toHaveAttribute("id", "our-homes");
    expect(screen.getByTestId("search-input")).toHaveAttribute("id", "search-form");
  });
});
