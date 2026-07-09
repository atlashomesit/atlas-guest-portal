import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookingCard from "@/components/homepage_components/hotelBooking_form/BookingCard";
import { MemoryRouter } from "react-router-dom";

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/utils/analytics", () => ({
  trackEvent: vi.fn(),
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

describe("BookingCard", () => {
  it("renders date search strip with Search and property id", () => {
    render(
      <MemoryRouter>
        <BookingCard propertyId={101} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /find your stay/i })).toBeInTheDocument();
    expect(screen.getByText("Check-in")).toBeInTheDocument();
    expect(document.querySelectorAll("input[type=\"date\"]").length).toBe(2);
    expect(screen.getByRole("button", { name: /^search$/i })).toBeInTheDocument();
    expect(document.getElementById("booking-form")).toHaveAttribute("data-property-id", "101");
  });

  it("seeds check-in/check-out with IST local dates, not UTC", () => {
    // Mock clock at 2026-07-09T23:00Z (04:30 IST, before 05:30 IST cutoff)
    // In UTC it's 2026-07-09, but in IST it's 2026-07-10
    const mockDate = new Date("2026-07-09T23:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    try {
      render(
        <MemoryRouter>
          <BookingCard />
        </MemoryRouter>,
      );

      const dateInputs = document.querySelectorAll("input[type=\"date\"]");
      const checkInInput = dateInputs[0] as HTMLInputElement;
      const checkOutInput = dateInputs[1] as HTMLInputElement;

      // At 04:30 IST (23:00 UTC previous day), IST local date is 2026-07-10
      // Check-in should be today in IST (2026-07-10), not UTC yesterday (2026-07-09)
      expect(checkInInput.value).toBe("2026-07-10");
      // Check-out should be tomorrow in IST (2026-07-11)
      expect(checkOutInput.value).toBe("2026-07-11");
    } finally {
      vi.useRealTimers();
    }
  });
});
