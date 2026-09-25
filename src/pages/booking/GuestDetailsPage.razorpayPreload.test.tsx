/**
 * TASK-102391 — Razorpay SDK is preloaded on checkout mount so Pay opens instantly
 * on slow mobile connections (first-tap fetch latency reads as "nothing happens").
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingProvider } from "@/contexts/BookingContext";
import GuestDetailsPage from "./GuestDetailsPage";

vi.mock("@/lib/events", () => ({ track: vi.fn() }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const CHECKOUT_HOLD_KEY = "atlas_guest_checkout_hold";

beforeEach(() => {
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
  document.querySelectorAll('script[src*="checkout.razorpay.com"]').forEach((s) => s.remove());
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("GuestDetailsPage Razorpay preload (TASK-102391)", () => {
  test("appends the Razorpay SDK script on mount", async () => {
    render(
      <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
        <BookingProvider>
          <GuestDetailsPage />
        </BookingProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.getElementById("gd-details-form")).toBeInTheDocument());
    const scripts = document.querySelectorAll('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    expect(scripts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/pay/i).length).toBeGreaterThanOrEqual(1);
  });
});
