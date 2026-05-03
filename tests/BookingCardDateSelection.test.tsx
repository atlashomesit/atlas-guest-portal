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
});
