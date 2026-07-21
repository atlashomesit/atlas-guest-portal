/**
 * TASK-4438: GuestDetailsPage form a11y — name/email/phone/promo/referral inputs
 * must have programmatically associated labels (WCAG 1.3.1 / 4.1.2), required
 * state conveyed non-colour-only, and validation errors linked via
 * aria-describedby (WCAG 3.3.2).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingProvider } from "@/contexts/BookingContext";
import GuestDetailsPage from "./GuestDetailsPage";

vi.mock("@/lib/events", () => ({ track: vi.fn() }));

// jsdom doesn't implement scrollIntoView (used by the page's focus-first-error handler)
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const CHECKOUT_HOLD_KEY = "atlas_guest_checkout_hold";

function seedActiveHold() {
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
}

async function renderPage() {
  const result = render(
    <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
      <BookingProvider>
        <GuestDetailsPage />
      </BookingProvider>
    </MemoryRouter>,
  );
  // wait for hold rehydration → form render
  await waitFor(() => expect(document.getElementById("gd-details-form")).toBeInTheDocument());
  return result;
}

beforeEach(() => {
  window.sessionStorage.clear();
  seedActiveHold();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("GuestDetailsPage form a11y", () => {
  test("name, email and phone inputs have accessible names and required state", async () => {
    await renderPage();

    const name = screen.getByLabelText(/full name/i);
    const email = screen.getByLabelText(/email/i);
    const phone = screen.getByLabelText(/^phone/i);

    expect(name).toHaveAttribute("id", "gd-name");
    expect(email).toHaveAttribute("id", "gd-email");
    expect(phone).toHaveAttribute("id", "gd-phone");

    // required conveyed non-colour-only (WCAG 3.3.2)
    expect(name).toHaveAttribute("aria-required", "true");
    expect(email).toHaveAttribute("aria-required", "true");
    expect(phone).toHaveAttribute("aria-required", "true");

    // persistent hints stay linked
    expect(email).toHaveAccessibleDescription(/booking confirmation goes here/i);
    expect(phone).toHaveAccessibleDescription(/booking updates and check-in details/i);
  });

  test("promo and referral inputs have accessible names", async () => {
    await renderPage();

    expect(screen.getByLabelText("Promo code")).toHaveAccessibleName("Promo code");
    expect(screen.getByLabelText("Referral code")).toHaveAccessibleName("Referral code");
  });

  test("validation errors are linked to their inputs via aria-describedby", async () => {
    await renderPage();

    fireEvent.submit(document.getElementById("gd-details-form")!);

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(3);
    });

    const name = screen.getByLabelText(/full name/i);
    const email = screen.getByLabelText(/email/i);
    const phone = screen.getByLabelText(/^phone/i);

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(phone).toHaveAttribute("aria-invalid", "true");

    expect(name).toHaveAccessibleDescription(/name is required/i);
    expect(email).toHaveAccessibleDescription(/email is required/i);
    expect(phone).toHaveAccessibleDescription(/phone number is required/i);
  });
});
