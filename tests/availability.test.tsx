import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
const fetchMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({ to, children, ...props }: { to: string | { pathname?: string }; children: React.ReactNode }) => (
    <a href={typeof to === "string" ? to : to?.pathname ?? "/"} {...props}>
      {children}
    </a>
  ),
  MemoryRouter: ({ children }: { children: React.ReactNode }) => <div data-router>{children}</div>,
  useLocation: () => ({ pathname: "/", search: "", hash: "", state: null, key: "default" }),
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParams, vi.fn()],
}));

vi.mock("react-date-range", () => ({
  DateRange: () => <div data-testid="mocked-date-range" />,
}));

vi.mock("@/contexts/BookingContext", () => ({
  useBooking: () => ({
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: 2 },
    updateBooking: vi.fn(),
    setProperty: vi.fn(),
    setDates: vi.fn(),
    setGuests: vi.fn(),
    pendingScrollTarget: null,
    setPendingScrollTarget: vi.fn(),
  }),
  BookingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import Slider from "@/components/homepage_components/slider/Slider";
import { BookingProvider } from "@/contexts/BookingContext";
import * as analytics from "@/utils/analytics";

describe("availability search flow", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    fetchMock.mockReset();
    searchParams = new URLSearchParams({
      checkIn: "2025-12-22",
      checkOut: "2025-12-23",
      guests: "2",
    });
    (window as typeof window & { __ATLAS_RUNTIME_CONFIG__?: { apiBaseUrl?: string } }).__ATLAS_RUNTIME_CONFIG__ = {
      apiBaseUrl: "https://api.example.com",
    };

    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ available: true }),
              }),
            150,
          );
        }),
    );

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    analytics.resetAnalyticsTransport();
  });

  it.skip("shows loading state, resolves availability within 3s, and updates URL with search params and hash", async () => {
    render(
      <MemoryRouter>
        <BookingProvider>
          <Slider />
        </BookingProvider>
      </MemoryRouter>,
    );

    const submitButton = screen.getByRole("button", { name: /check availability/i });
    fireEvent.click(submitButton);

    expect(await screen.findByRole("button", { name: /checking/i })).toBeInTheDocument();
    expect(await screen.findByText("Showing available homes for your dates.")).toBeInTheDocument();

    const expectedSearch = "checkIn=2025-12-22&checkOut=2025-12-23&guests=2";

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/availability?${expectedSearch}`,
      expect.any(Object),
    );

    expect(navigateMock).toHaveBeenCalledWith({
      pathname: "/",
      search: expectedSearch,
      hash: "our-homes",
    });
  });
});
