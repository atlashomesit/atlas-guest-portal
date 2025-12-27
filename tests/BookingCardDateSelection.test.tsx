import React from "react";
import { act, render, screen } from "@testing-library/react";
import { addDays, format, startOfDay } from "date-fns";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import BookingCard from "@/components/homepage_components/hotelBooking_form/BookingCard";
import { MemoryRouter } from "react-router-dom";
import { getIstStartOfDay, getIstCalendarDate } from "@/utils/date";

const mockIstContext: { current: Date | null } = { current: null };

vi.mock("@/utils/date", async () => {
  const actual = await vi.importActual<typeof import("@/utils/date")>("@/utils/date");
  return {
    ...actual,
    getIstStartOfDay: (date: Date = mockIstContext.current ?? new Date()) =>
      actual.getIstStartOfDay(date),
    getIstCalendarDate: (date: Date = mockIstContext.current ?? new Date()) =>
      actual.getIstCalendarDate(date),
  };
});

const mockTrackEvent = vi.fn();
const mockUpdateBooking = vi.fn();
const mockApiGet = vi.fn(async () => ({ data: [] }));
let capturedDateRangeProps: { onChange?: (ranges: any) => void } = {};

vi.mock("@/utils/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  resetAnalyticsTransport: vi.fn(),
  setAnalyticsTransport: vi.fn(),
}));

vi.mock("@/contexts/BookingContext", () => ({
  useBooking: () => ({
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: 2 },
    updateBooking: mockUpdateBooking,
    setProperty: vi.fn(),
    setDates: vi.fn(),
    setGuests: vi.fn(),
    pendingScrollTarget: null,
    setPendingScrollTarget: vi.fn(),
  }),
  BookingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
  asArray: () => [],
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: "/", search: "", hash: "" }),
  };
});

vi.mock("react-date-range", () => ({
  DateRange: (props: any) => {
    capturedDateRangeProps = props;
    return <div data-testid="date-range-mock" />;
  },
}));

const renderBookingCard = () =>
  render(
    <MemoryRouter>
      <BookingCard propertyId={101} />
    </MemoryRouter>,
  );

const openCalendar = () => {
  const checkInButton = screen.getByRole("button", { name: /select check-in date/i });
  act(() => {
    checkInButton.click();
  });
};

const selectDates = (checkIn: Date, checkOut: Date) => {
  const triggerChange = (selection: { startDate: Date; endDate: Date }) => {
    const onChange = capturedDateRangeProps.onChange as ((ranges: any) => void) | undefined;
    if (!onChange) throw new Error("DateRange onChange handler was not captured");

    act(() => {
      onChange({ selection });
    });
  };

  triggerChange({ startDate: checkIn, endDate: checkIn });
  triggerChange({ startDate: checkIn, endDate: checkOut });
};

describe("BookingCard date selection", () => {
  beforeEach(() => {
    capturedDateRangeProps = {};
    mockTrackEvent.mockReset();
    mockUpdateBooking.mockReset();
    mockApiGet.mockReset();
    mockIstContext.current = null;
  });

  afterEach(() => {
    mockIstContext.current = null;
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])("handles %d-night stays without moving check-in", async (nights) => {
    renderBookingCard();

    openCalendar();
    await screen.findByTestId("date-range-mock");

    const checkIn = startOfDay(new Date("2030-01-28T00:00:00Z"));
    const checkOut = startOfDay(addDays(checkIn, nights));

    selectDates(checkIn, checkOut);

    expect(screen.getByText(format(checkIn, "dd-MM-yyyy"))).toBeInTheDocument();
    expect(screen.getByText(format(checkOut, "dd-MM-yyyy"))).toBeInTheDocument();
  });

  it("bumps checkout only when the second click is not after check-in", async () => {
    renderBookingCard();

    openCalendar();
    await screen.findByTestId("date-range-mock");

    const checkIn = startOfDay(new Date("2030-02-18T00:00:00Z"));
    const invalidCheckout = startOfDay(new Date("2030-02-15T00:00:00Z"));

    selectDates(checkIn, invalidCheckout);

    expect(screen.getByText(format(checkIn, "dd-MM-yyyy"))).toBeInTheDocument();
    expect(screen.getByText(format(addDays(checkIn, 1), "dd-MM-yyyy"))).toBeInTheDocument();
  });

  it("treats IST as the source of truth for disabling past dates", async () => {
    mockIstContext.current = new Date("2025-01-01T20:00:00Z");

    renderBookingCard();
    openCalendar();
    await screen.findByTestId("date-range-mock");

    const expectedIstToday = getIstStartOfDay();
    const pastUtcDate = new Date("2025-01-01T00:00:00Z");
    const nextUtcDate = new Date("2025-01-02T00:00:00Z");

    expect(capturedDateRangeProps.minDate.getTime()).toBe(expectedIstToday.getTime());
    expect(capturedDateRangeProps.disabledDay(pastUtcDate)).toBe(true);
    expect(capturedDateRangeProps.disabledDay(nextUtcDate)).toBe(false);
  });

  it("prevents applying past check-in dates by resetting to the IST day", async () => {
    mockIstContext.current = new Date("2025-01-01T20:00:00Z");

    renderBookingCard();
    openCalendar();
    await screen.findByTestId("date-range-mock");

    const pastCheckIn = new Date("2024-12-30T00:00:00Z");
    const pastCheckout = addDays(pastCheckIn, 2);
    const istToday = getIstCalendarDate();

    selectDates(pastCheckIn, pastCheckout);

    expect(await screen.findByText(format(istToday, "dd-MM-yyyy"))).toBeInTheDocument();
    expect(await screen.findByText(format(addDays(istToday, 1), "dd-MM-yyyy"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select check-in date/i })).toHaveAttribute("aria-invalid", "true");
  });
});
