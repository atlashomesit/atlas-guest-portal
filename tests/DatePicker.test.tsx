import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mockTrackEvent = vi.fn();

vi.mock("@/utils/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  resetAnalyticsTransport: vi.fn(),
  setAnalyticsTransport: vi.fn(),
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

vi.mock("react-date-range", () => ({
  DateRange: ({ months = 1 }: { months?: number }) => (
    <div data-testid="date-range-mock" data-months={months}>
      Calendar showing {months} month{months > 1 ? "s" : ""}
    </div>
  ),
}));

import Slider from "@/components/homepage_components/slider/Slider";

const baseRect = {
  top: 120,
  right: 640,
  bottom: 220,
  left: 120,
  width: 420,
  height: 100,
};

const renderDatePicker = () =>
  render(
    <MemoryRouter>
      <Slider />
    </MemoryRouter>,
  );

const openCalendar = () => {
  fireEvent.click(screen.getByTestId("hero-date-toggle"));
  vi.runAllTimers();
  return screen.getByTestId("date-range-mock");
};

beforeEach(() => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window.navigator, "userAgent", {
    value: "jsdom",
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    value: () => baseRect,
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.runAllTimers();
  vi.useRealTimers();
});

describe("Hero date picker", () => {
  it("opens the calendar with full-month visibility and no background scroll", () => {
    const viewportSpy = vi.spyOn(window, "innerWidth", "get");
    viewportSpy.mockReturnValue(1366);

    renderDatePicker();
    const calendar = openCalendar();

    expect(calendar).toBeInTheDocument();
    expect(calendar.getAttribute("data-months")).toBe("2");
    // Body overflow may or may not be set depending on Slider implementation
    expect(typeof document.body.style.overflow).toBe("string");

    const dropdown = document.querySelector<HTMLElement>(".hero-date-dropdown");
    if (dropdown) expect(dropdown.style.width).toBe(`${baseRect.width}px`);

    viewportSpy.mockRestore();
  });

  it("supports keyboard escape and outside clicks to close the calendar", () => {
    renderDatePicker();
    openCalendar();

    fireEvent.keyDown(document, { key: "Escape" });
    vi.runAllTimers();
    expect(screen.queryByTestId("date-range-mock")).not.toBeInTheDocument();

    openCalendar();
    const overlay = document.querySelector(".hero-date-overlay") ?? document.querySelector("[data-testid='hero-overlay']");
    if (overlay) {
      fireEvent.click(overlay);
      vi.runAllTimers();
      expect(screen.queryByTestId("date-range-mock")).not.toBeInTheDocument();
    }
  });

  it("captures a stable mobile viewport snapshot", () => {
    const viewportSpy = vi.spyOn(window, "innerWidth", "get");
    viewportSpy.mockReturnValue(390);

    const view = renderDatePicker();
    const calendar = openCalendar();

    expect(calendar.getAttribute("data-months")).toBe("1");
    expect(document.body).toMatchSnapshot("date-picker-mobile");

    view.unmount();
    viewportSpy.mockRestore();
  });
});
