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
import { homes } from "../../../content/homes";
import { BookingProvider } from "../../../contexts/BookingContext";

const renderNavbar = (initialEntries: string[] = ["/"]) => {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <BookingProvider>
        <Navbar />
      </BookingProvider>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
});

describe("Navbar CTA", () => {
  it("renders Contact navigation as internal links across desktop and mobile", () => {
    renderNavbar();

    const contactLink = screen.getByRole("link", { name: /^Contact$/i });
    expect(contactLink).toHaveAttribute("href", "/contact");

    const menuToggle = screen.getByRole("button", { name: /toggle navigation/i });
    fireEvent.click(menuToggle);

    const contactMobile = screen
      .getAllByRole("link", { name: /^Contact$/i })
      .find((link) => link.closest("#mobile-menu-panel"));

    expect(contactMobile).toBeDefined();
    expect(contactMobile).toHaveAttribute("href", "/contact");
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

  it("shows the Our Homes dropdown", async () => {
    renderNavbar();

    const trigger = screen.getByRole("button", { name: /our homes/i });
    fireEvent.click(trigger);

    for (const home of homes) {
      expect(await screen.findByRole("menuitem", { name: home.title })).toBeInTheDocument();
    }
  });
});
