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

import Home from "./Home";
import { BookingProvider } from "../../contexts/BookingContext";

describe("Homepage layout", () => {
  it("exposes the Our Homes anchor for in-page navigation", () => {
    render(
      <MemoryRouter>
        <BookingProvider>
          <Home />
        </BookingProvider>
      </MemoryRouter>,
    );

    const ourHomesSection = screen.getByRole("heading", { name: /our homes/i }).closest("section");
    expect(ourHomesSection).toHaveAttribute("id", "our-homes");
    expect(screen.getByTestId("hero-widget")).toHaveAttribute("id", "search-form");  });
});
