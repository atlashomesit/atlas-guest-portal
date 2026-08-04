import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("../../../utils/analytics")>("../../../utils/analytics");
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

import Navbar from "./Navbar";
import { trackEvent } from "../../../utils/analytics";
import { BookingProvider } from "../../../contexts/BookingContext";
import { CurrencyProvider } from "../../../contexts/CurrencyContext";

const renderNavbar = (initialEntries: string[] = ["/"]) => {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <CurrencyProvider>
        <BookingProvider>
          <Navbar />
        </BookingProvider>
      </CurrencyProvider>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  document.getElementById("booking-form")?.remove();
  document.querySelectorAll('[data-testid="guest-booking-form"]').forEach((node) => node.remove());
});

describe("Navbar CTA", () => {
  it("renders Help navigation as internal link (replaces Contact — Gap 1 simplification)", () => {
    renderNavbar();

    const helpLink = screen.getByRole("link", { name: /^Help$/i });
    expect(helpLink).toHaveAttribute("href", "/contact");
  });

  it("renders simplified center nav: Stays, Location, Trips menu, Help — no duplicates of utility bar", () => {
    renderNavbar();

    expect(screen.getByRole("link", { name: /^Stays$/i })).toBeInTheDocument();
    // Label is the tenant-neutral 'Location' since e1a68c3c replaced the hardcoded
    // 'Hyderabad' in src/config/navigation.ts (guest portal is multi-tenant).
    expect(screen.getByRole("link", { name: /^Location$/i })).toBeInTheDocument();
    expect(screen.getByTestId("navbar-trips-menu")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("navbar-trips-menu"));
    expect(screen.getByRole("menuitem", { name: /my bookings/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Help$/i })).toBeInTheDocument();

    // Utility-bar items must NOT appear in the main navbar right section
    expect(screen.queryByTestId("navbar-list-property")).toBeNull();
    expect(screen.queryByTestId("navbar-host-login")).toBeNull();
  });

  it("routes Book Now to the dedicated search/reserve flow with a visible transition", () => {
    renderNavbar();

    const bookNow = screen.getByRole("button", { name: /book now/i });
    fireEvent.click(bookNow);

    expect(screen.getByText(/opening reservation/i)).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({
        state: { bookingPrefill: expect.objectContaining({ guests: 2 }) },
      }),
    );

    expect(trackEvent).toHaveBeenCalledWith(
      "cta_book_now_clicked",
      expect.objectContaining({ source: "header", surface: "navbar" }),
      expect.any(Object),
    );
  });

  it("smoothly scrolls to and focuses the booking form on property detail pages", () => {
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const bookingForm = document.createElement("div");
    bookingForm.id = "booking-form";
    bookingForm.setAttribute("tabindex", "0");
    // @ts-expect-error jsdom type
    bookingForm.scrollIntoView = scrollIntoView;
    Object.defineProperty(bookingForm, "focus", { value: focus });
    document.body.appendChild(bookingForm);

    renderNavbar(["/property_details/123"]);

    const bookNow = screen.getByRole("button", { name: /book now/i });
    fireEvent.click(bookNow);

    expect(screen.getByText(/bringing booking form into view/i)).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      "cta_book_now_clicked",
      expect.objectContaining({ target: "booking-form", surface: "property_details" }),
      { route: "/property_details/123#booking-form" },
    );
  });

  it("smoothly scrolls to the booking form on current /homes detail pages", () => {
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const bookingForm = document.createElement("form");
    bookingForm.setAttribute("data-testid", "guest-booking-form");
    // @ts-expect-error jsdom type
    bookingForm.scrollIntoView = scrollIntoView;
    Object.defineProperty(bookingForm, "focus", { value: focus });
    document.body.appendChild(bookingForm);

    renderNavbar(["/homes/atlas-homes/123"]);

    const bookNow = screen.getByRole("button", { name: /book now/i });
    fireEvent.click(bookNow);

    expect(screen.getByText(/bringing booking form into view/i)).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
