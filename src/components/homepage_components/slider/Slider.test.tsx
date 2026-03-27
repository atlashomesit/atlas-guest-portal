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
    useLocation: () => ({ pathname: "/", search: "", hash: "", state: null, key: "default" }),
    useNavigate: () => navigateMock,
    useSearchParams: () => [searchParams, vi.fn()],
  };
});

vi.mock("react-date-range", () => ({
  DateRange: ({
    onChange,
    ranges,
    disabledDay,
  }: {
    onChange: (payload: unknown) => void;
    ranges?: Array<{ startDate: Date; endDate: Date }>;
    disabledDay?: (date: Date) => boolean;
  }) => {
    const base = ranges?.[0]?.startDate ?? new Date();
    const next = ranges?.[0]?.endDate ?? addDays(base, 1);
    const days = [addDays(base, -1), base, next, addDays(base, 3), addDays(base, 4)];

    return (
      <div role="grid">
        {days.map((day) => {
          const isDisabled = disabledDay?.(day) ?? false;

          return (
            <button
              key={format(day, "yyyy-MM-dd")}
              data-testid={`hero-date-${format(day, "yyyy-MM-dd")}`}
              type="button"
              aria-disabled={isDisabled}
              disabled={isDisabled}
              className={isDisabled ? "disabled-day" : ""}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                if (isDisabled) return;

                const useSameDay = event.shiftKey;

                onChange({
                  selection: { startDate: day, endDate: useSameDay ? day : addDays(day, 1) },
                });
              }}
            >
              {format(day, "d")}
            </button>
          );
        })}
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

const _renderSliderAtWidth = (width: number) => {
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
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
    expect(overlay.style.backgroundImage).toMatch(/linear-gradient|linear-gradient-overlay/i);
    expect(screen.getByRole("heading", { name: /Thoughtfully curated stays/i })).toBeInTheDocument();
    expect(screen.getByText(/Verified homes/i)).toBeInTheDocument();
  });

  it("shows CTA hierarchy with primary button and secondary link", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: /check availability/i })).toBeInTheDocument();
    const browseLink = screen.getByRole("link", { name: /browse all apartments/i });
    expect(browseLink.tagName.toLowerCase()).toBe("a");
  });

  it("blocks past dates from being selected", () => {
    renderSlider();
    fireEvent.click(screen.getAllByTestId("hero-date-toggle")[0]);

    const yesterdayTestId = `hero-date-${format(addDays(new Date(), -1), "yyyy-MM-dd")}`;
    const pastDateButton = screen.getByTestId(yesterdayTestId) as HTMLButtonElement;

    expect(pastDateButton).toBeDisabled();
    fireEvent.click(pastDateButton);

    expect(screen.getByRole("status")).toHaveTextContent(/hero form ready/i);
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
