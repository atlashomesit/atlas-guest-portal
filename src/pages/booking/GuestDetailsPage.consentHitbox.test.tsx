/**
 * TASK-102395 — consent rows are full-card tap targets (≥48px), and clicking the
 * label text toggles the checkbox (no 12px-hitbox trap).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

async function renderPage() {
  render(
    <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
      <BookingProvider>
        <GuestDetailsPage />
      </BookingProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.getElementById("gd-details-form")).toBeInTheDocument());
}

describe("GuestDetailsPage consent hitbox (TASK-102395)", () => {
  test("consent row guarantees a 48px minimum touch target", async () => {
    await renderPage();
    const row = await screen.findByTestId("guest-booking-consent-row");
    const style = window.getComputedStyle(row);
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(48);
  });

  test("clicking the label text toggles consent", async () => {
    await renderPage();
    const row = await screen.findByTestId("guest-booking-consent-row");
    expect(row).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByText(/collecting and using my name/i));
    expect(row).toHaveAttribute("aria-checked", "true");
  });
});
