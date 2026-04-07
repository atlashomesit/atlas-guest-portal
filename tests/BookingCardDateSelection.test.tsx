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
  it("renders booking form with email, phone, and Book Now", () => {
    render(
      <MemoryRouter>
        <BookingCard propertyId={101} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /book your stay/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^book now$/i })).toBeInTheDocument();
    expect(document.getElementById("booking-form")).toHaveAttribute("data-property-id", "101");
  });
});
