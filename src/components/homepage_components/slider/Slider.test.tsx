import React from "react";
import { addDays, format } from "date-fns";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("react-router-dom", () => {
  const searchParams = new URLSearchParams();

  return {
    __esModule: true,
    Link: ({ to, children, ...props }: { to: string | { pathname?: string }; children: React.ReactNode }) => (
      <a href={typeof to === "string" ? to : to?.pathname ?? "/"} {...props}>
        {children}
      </a>
    ),
    MemoryRouter: ({ children }: { children: React.ReactNode }) => <div data-router>{children}</div>,
    useNavigate: () => navigateMock,
    useSearchParams: () => [searchParams, vi.fn()],
  };
});

vi.mock("react-date-range", () => ({
  DateRange: ({ onChange, ranges }: { onChange: (payload: unknown) => void; ranges?: Array<{ startDate: Date; endDate: Date }> }) => {
    const base = ranges?.[0]?.startDate ?? new Date();
    const next = ranges?.[0]?.endDate ?? addDays(base, 1);
    const days = [base, next, addDays(base, 3), addDays(base, 4)];

    return (
      <div>
        {days.map((day) => (
          <button
            key={format(day, "yyyy-MM-dd")}
            data-testid={`hero-date-${format(day, "yyyy-MM-dd")}`}
            type="button"
            onClick={() =>
              onChange({
                selection: { startDate: day, endDate: addDays(day, 1) },
              })
            }
          >
            {format(day, "d")}
          </button>
        ))}
      </div>
    );
  },
}));
vi.mock("../../../contexts/BookingContext", () => ({
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
import Slider from "./Slider";
import * as analytics from "../../../utils/analytics";
import { BookingProvider } from "../../../contexts/BookingContext";

const renderSlider = () =>
  render(
    <MemoryRouter>
      <BookingProvider>
        <Slider />
      </BookingProvider>
    </MemoryRouter>,
  );

const renderSliderAtWidth = (width: number) => {
  const viewportSpy = vi.spyOn(window, "innerWidth", "get");
  viewportSpy.mockReturnValue(width);
  const utils = renderSlider();
  return { ...utils, viewportSpy };
};

describe("Slider hero search", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-22T00:00:00.000Z"));
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    analytics.resetAnalyticsTransport();
    vi.runAllTimers();
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders without crashing", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
  });

  it("renders hero overlay and trust microcopy", () => {
    renderSlider();
    const overlay = screen.getByTestId("hero-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.style.backgroundImage).toMatch(/linear-gradient/i);
    expect(screen.getByText(/book with confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/instant confirmation • secure payments • no hidden charges/i)).toBeInTheDocument();
  });

  it("shows CTA hierarchy with primary button and secondary link", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
    const browseLink = screen.getByRole("link", { name: /browse listings/i });
    expect(browseLink.tagName.toLowerCase()).toBe("a");
  });

  it.skip("captures hero widget snapshots for desktop, tablet, and mobile", () => {
    const desktop = renderSliderAtWidth(1366);
    expect(desktop.asFragment()).toMatchSnapshot("hero-widget-desktop");
    desktop.unmount();
    desktop.viewportSpy.mockRestore();

    const tablet = renderSliderAtWidth(980);
    expect(tablet.asFragment()).toMatchSnapshot("hero-widget-tablet");
    tablet.unmount();
    tablet.viewportSpy.mockRestore();

    const mobile = renderSliderAtWidth(390);
    expect(mobile.asFragment()).toMatchSnapshot("hero-widget-mobile");
    mobile.unmount();
    mobile.viewportSpy.mockRestore();
  });

  it("updates summary and tracks search when a date range is selected", () => {
    renderSlider();

    const startDate = addDays(new Date(), 3);
    const endDate = addDays(startDate, 1);

    const startTestId = `hero-date-${format(startDate, "yyyy-MM-dd")}`;
    const endTestId = `hero-date-${format(endDate, "yyyy-MM-dd")}`;

    fireEvent.click(screen.getByTestId("hero-date-toggle"));
    const startCells = screen.queryAllByTestId(startTestId);
    const endCells = screen.queryAllByTestId(endTestId);
    expect(startCells.length).toBeGreaterThan(0);
    expect(endCells.length).toBeGreaterThan(0);
    fireEvent.click(startCells[0]);
    fireEvent.click(endCells[0]);

    expect(screen.getAllByText(/guests/i).length).toBeGreaterThan(0);

    const capturedEvents: analytics.AnalyticsEventPayload[] = [];
    analytics.setAnalyticsTransport((payload) => capturedEvents.push(payload));

    const submitButton = screen.getByRole("button", { name: /check availability/i });
    fireEvent.click(submitButton);

    expect(capturedEvents.map((event) => event.event)).toContain("availability_search");
  });

  it("tracks interactions for date, guest, and CTA actions", () => {
    renderSlider();
    const capturedEvents: analytics.AnalyticsEventPayload[] = [];
    analytics.setAnalyticsTransport((payload) => capturedEvents.push(payload));

    fireEvent.click(screen.getByTestId("hero-date-toggle"));
    const startDate = addDays(new Date(), 3);
    const endDate = addDays(startDate, 1);
    const startCell = screen.getAllByTestId(`hero-date-${format(startDate, "yyyy-MM-dd")}`)[0].closest("button");
    const endCell = screen.getAllByTestId(`hero-date-${format(endDate, "yyyy-MM-dd")}`)[0].closest("button");
    expect(startCell).toBeTruthy();
    expect(endCell).toBeTruthy();
    fireEvent.click(startCell!);
    fireEvent.click(endCell!);
    expect(capturedEvents.map((event) => event.event)).toContain("hero_dates_changed");

    fireEvent.click(screen.getByRole("button", { name: "Increase guests" }));
    const guestEvent = capturedEvents.find((event) => event.event === "hero_guests_changed");
    expect(guestEvent).toBeDefined();

    const ctaButton = screen.getByRole("button", { name: /check availability/i });
    fireEvent.click(ctaButton);
    expect(capturedEvents.map((event) => event.event)).toContain("hero_primary_cta_click");
  });

  it("shows exactly three high-signal trust badges", () => {
    renderSlider();
    const trustBadges = screen.getByTestId("trust-badges");
    expect(trustBadges).toBeInTheDocument();
    expect(screen.getByText(/verified homes/i)).toBeInTheDocument();
    expect(screen.getByText(/secure razorpay payments/i)).toBeInTheDocument();
    expect(screen.getByText(/no hidden fees/i)).toBeInTheDocument();
    expect(trustBadges).not.toHaveTextContent(/flexible cancellation/i);
    expect(trustBadges.querySelectorAll(".rb-trust-badge").length).toBe(3);
  });
});
