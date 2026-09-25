/**
 * TASK-102394 — focused checkout fields scroll into view above the mobile keyboard.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingProvider } from "@/contexts/BookingContext";
import GuestDetailsPage from "./GuestDetailsPage";

vi.mock("@/lib/events", () => ({ track: vi.fn() }));

const scrollSpy = vi.fn();
window.HTMLElement.prototype.scrollIntoView = scrollSpy;

const CHECKOUT_HOLD_KEY = "atlas_guest_checkout_hold";

beforeEach(() => {
  scrollSpy.mockClear();
  window.sessionStorage.clear();
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
    }),
  );
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("GuestDetailsPage focus scroll (TASK-102394)", () => {
  test.each(["guest-booking-name", "guest-booking-email", "guest-booking-phone"])(
    "focusing %s scrolls it into view",
    async (testid) => {
      render(
        <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
          <BookingProvider>
            <GuestDetailsPage />
          </BookingProvider>
        </MemoryRouter>,
      );
      const input = await screen.findByTestId(testid);
      fireEvent.focus(input);
      await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
      expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    },
  );
});
