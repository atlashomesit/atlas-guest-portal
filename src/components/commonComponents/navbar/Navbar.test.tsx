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

vi.mock("../../../tenant/tenantContext", () => ({
  getTenantContext: vi.fn(() => null),
}));

vi.mock("../../../tenant/tenantOverrides", async () => {
  const actual = await vi.importActual<typeof import("../../../tenant/tenantOverrides")>(
    "../../../tenant/tenantOverrides",
  );
  return {
    ...actual,
    getTenantOverrides: vi.fn(() => ({})),
  };
});

import Navbar from "./Navbar";
import { trackEvent } from "../../../utils/analytics";
import { getTenantContext } from "../../../tenant/tenantContext";
import { getTenantOverrides } from "../../../tenant/tenantOverrides";
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

  it("TASK-7434: hides Atlas host-acquisition CTAs for white-label tenants", () => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: "staybycf", name: "Stay by CF" });
    vi.mocked(getTenantOverrides).mockReturnValue({});

    renderNavbar();

    expect(screen.queryByText("List your property")).toBeNull();
    expect(screen.queryByText("Host login")).toBeNull();
    expect(screen.queryByTestId("navbar-list-property")).toBeNull();
    expect(screen.queryByTestId("navbar-host-login")).toBeNull();
  });

  it("TASK-7434: shows host-acquisition CTAs on the atlas marketplace tenant", () => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: "atlas", name: "Atlas Homes" });
    vi.mocked(getTenantOverrides).mockReturnValue({});

    renderNavbar();

    expect(screen.getByTestId("navbar-list-property")).toHaveTextContent("List your property");
    expect(screen.getByTestId("navbar-host-login")).toHaveTextContent("Host login");
  });

  it("DESIGN-026: renders a persistent mobile search pill", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 });
    renderNavbar();

    const pill = screen.getByTestId("mobile-search-pill");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute("aria-label", "Search stays");
    expect(pill).toHaveTextContent("Where to?");
  });

  it("DESIGN-026: mobile search pill opens full-screen overlay", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 });
    renderNavbar();

    const pill = screen.getByTestId("mobile-search-pill");
    fireEvent.click(pill);

    const overlay = screen.getByTestId("mobile-search-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute("role", "dialog");
    expect(overlay).toHaveAttribute("aria-modal", "true");

    // Close button works
    const closeBtn = screen.getByTestId("mobile-search-overlay-close");
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId("mobile-search-overlay")).toBeNull();
  });

  it("DESIGN-026: mobile search overlay navigates to /search on submit", () => {
    renderNavbar();

    fireEvent.click(screen.getByTestId("mobile-search-pill"));
    const input = screen.getByTestId("mobile-search-destination-input");
    fireEvent.change(input, { target: { value: "Goa" } });

    fireEvent.click(screen.getByTestId("mobile-search-submit"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/search?destination=Goa",
      expect.objectContaining({ state: { fromMobileSearch: true } }),
    );
  });

  it("DESIGN-026: handleBookNow is not regressed by mobile search changes", () => {
    renderNavbar();

    // Book Now still functions exactly as before
    const bookNow = screen.getByRole("button", { name: /book now/i });
    fireEvent.click(bookNow);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/search",
      expect.objectContaining({
        state: { bookingPrefill: expect.objectContaining({ guests: 2 }) },
      }),
    );
  });

  it("TASK-7088: mobile menu has no duplicate destinations", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 });
    renderNavbar();

    const hamburger = screen.getByRole("button", { name: /toggle navigation/i });
    fireEvent.click(hamburger);

    const panel = document.getElementById("mobile-menu-panel");
    expect(panel).toBeTruthy();
    const hrefs = Array.from(panel!.querySelectorAll("a[href]")).map(
      (a) => (a as HTMLAnchorElement).getAttribute("href"),
    );
    const duplicates = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
    expect(duplicates).toEqual([]);
  });
});
