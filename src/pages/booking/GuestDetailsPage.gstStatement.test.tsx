import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingProvider } from "@/contexts/BookingContext";
import GuestDetailsPage from "./GuestDetailsPage";

vi.mock("@/lib/events", () => ({ track: vi.fn() }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const CHECKOUT_HOLD_KEY = "atlas_guest_checkout_hold";

describe("TASK-102021: Guest checkout GST statement", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders 'Includes GST · INR' when the order carries GST", async () => {
    window.sessionStorage.setItem(
      CHECKOUT_HOLD_KEY,
      JSON.stringify({
        holdId: 42,
        holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        holdPropertySlug: "atlas-prop",
        holdUnitSlug: "atlas-unit",
        holdListingName: "Atlas Unit",
        checkIn: "2026-08-01",
        checkOut: "2026-08-03",
        guests: 2,
        holdPriceBreakdown: {
          baseAmount: 7000,
          discountAmount: 0,
          gstAmount: 840,
          convenienceFeeAmount: 210,
          touristTaxAmount: 0,
          finalAmount: 8050,
          nights: 2,
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
        <BookingProvider>
          <GuestDetailsPage />
        </BookingProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const gstNote = screen.getByTestId("checkout-total-gst-note");
      expect(gstNote).toBeInTheDocument();
      expect(gstNote.textContent).toBe("Includes GST · INR");
    });
  });

  it("states total without GST claim ('INR') for unregistered host with gstAmount: 0", async () => {
    window.sessionStorage.setItem(
      CHECKOUT_HOLD_KEY,
      JSON.stringify({
        holdId: 43,
        holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        holdPropertySlug: "atlas-prop",
        holdUnitSlug: "atlas-unit",
        holdListingName: "Atlas Unit",
        checkIn: "2026-08-01",
        checkOut: "2026-08-03",
        guests: 2,
        holdPriceBreakdown: {
          baseAmount: 7000,
          discountAmount: 0,
          gstAmount: 0,
          convenienceFeeAmount: 210,
          touristTaxAmount: 0,
          finalAmount: 7210,
          nights: 2,
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
        <BookingProvider>
          <GuestDetailsPage />
        </BookingProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const gstNote = screen.getByTestId("checkout-total-gst-note");
      expect(gstNote).toBeInTheDocument();
      expect(gstNote.textContent).toBe("INR");
      expect(gstNote.textContent).not.toContain("Includes GST");
    });
  });
});
