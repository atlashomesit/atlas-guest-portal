import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../utils/analytics")>("../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

vi.mock("../../api/listingClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/listingClient")>();
  return {
    ...actual,
    fetchPublicListings: vi.fn(() =>
      Promise.resolve([
        {
          id: 501,
          propertyId: 501,
          maxGuests: 6,
          name: "Penthouse Suite 501",
        },
      ]),
    ),
    fetchPropertyListingPhotos: vi.fn(() => Promise.resolve([])),
  };
});

import Home from "./Home";
import { BookingProvider } from "../../contexts/BookingContext";

describe("Homepage layout", () => {
  it(
    "exposes the Our Homes anchor for in-page navigation",
    { timeout: 30000 },
    async () => {
      render(
        <MemoryRouter>
          <BookingProvider>
            <Home />
          </BookingProvider>
        </MemoryRouter>,
      );

      // HomePage_Locations uses `Our ${unitNoun.capitalPlural}` (e.g. Our Homestays), not the literal "Our Homes".
      const ourHomesSection = await waitFor(() => {
        const el = document.querySelector("section.scroll-mt-28#our-homes");
        if (!el) throw new Error("our-homes section not mounted yet");
        return el;
      });
      expect(ourHomesSection).toBeInTheDocument();
      expect(
        within(ourHomesSection as HTMLElement).getByRole("heading", { level: 2, name: /^our /i }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("search-input")).toHaveAttribute("id", "search-form");
    },
  );
});
