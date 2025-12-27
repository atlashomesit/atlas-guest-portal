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
  it("routes Book Now to the dedicated reserve flow", () => {
    renderNavbar();

    const bookNow = screen.getByRole("button", { name: /book now/i });
    bookNow.click();

    expect(trackEvent).toHaveBeenCalledWith(
      "cta_book_now_clicked",
      expect.objectContaining({ source: "header", target: "reserve", surface: "navbar" }),
      { route: "/reserve" },
    );
  });

  it("emits a tracking event when Book Now is clicked", () => {
    renderNavbar();

    const bookNow = screen.getByRole("button", { name: /book now/i });
    bookNow.click();

    expect(trackEvent).toHaveBeenCalledWith(
      "cta_book_now_clicked",
      expect.objectContaining({ source: "header", target: "reserve", surface: "navbar" }),
      { route: "/reserve" },
    );
  });

  it("smoothly scrolls to the booking form on property detail pages", () => {
    const scrollIntoView = vi.fn();
    const bookingForm = document.createElement("div");
    bookingForm.id = "booking-form";
    // @ts-expect-error jsdom type
    bookingForm.scrollIntoView = scrollIntoView;
    document.body.appendChild(bookingForm);

    render(
      <MemoryRouter initialEntries={["/property_details/123"]}>
        <BookingProvider>
          <Navbar />
        </BookingProvider>
      </MemoryRouter>,
    );

    const bookNow = screen.getByRole("button", { name: /book now/i });
    fireEvent.click(bookNow);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(trackEvent).toHaveBeenCalledWith(
      "cta_book_now_clicked",
      expect.objectContaining({ target: "booking-form", surface: "property_details" }),
      { route: "/property_details/123#booking-form" },
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
