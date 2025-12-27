import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

import Navbar from "./Navbar";
import { trackEvent } from "../../../utils/analytics";
import { homes } from "../../../content/homes";
import { BookingProvider } from "../../../contexts/BookingContext";

const renderNavbar = () =>
  render(
    <MemoryRouter>
      <BookingProvider>
        <Navbar />
      </BookingProvider>
    </MemoryRouter>,
  );

describe("Navbar CTA", () => {
  it("routes Book Now to the on-site Our Homes anchor", () => {
    renderNavbar();

    const bookNow = screen.getByRole("button", { name: /book now/i });
    bookNow.click();

    expect(trackEvent).toHaveBeenCalledWith(
      "cta_book_now_clicked",
      expect.objectContaining({ source: "header", target: "search-form" }),
      { route: "/#search-form" },
    );
  });

  it("emits a tracking event when Book Now is clicked", () => {
    renderNavbar();

    const bookNow = screen.getByRole("button", { name: /book now/i });
    bookNow.click();

    expect(trackEvent).toHaveBeenCalledWith(
      "cta_book_now_clicked",
      expect.objectContaining({ source: "header", target: "search-form" }),
      { route: "/#search-form" },
    );
  });

  it("shows the Our Homes dropdown", async () => {
    renderNavbar();

    const trigger = screen.getByRole("button", { name: /our homes/i });
    fireEvent.click(trigger);

    for (const home of homes) {
      expect(await screen.findByRole("menuitem", { name: home.title })).toBeInTheDocument();
    }
  });
});
