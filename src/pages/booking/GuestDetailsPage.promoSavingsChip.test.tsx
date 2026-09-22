/**
 * TASK-102118: promo code input in the guest booking drawer must celebrate a
 * valid coupon with an animated green discount-savings chip that displays the
 * EXACT rupee savings (the already-computed discount figure — never
 * recomputed in the UI) and offers a 1-click remove (x) button wired to the
 * existing coupon-clear path.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingProvider } from "@/contexts/BookingContext";
import GuestDetailsPage from "./GuestDetailsPage";

vi.mock("@/lib/events", () => ({ track: vi.fn() }));

// jsdom doesn't implement scrollIntoView (used by the page's focus-first-error handler)
window.HTMLElement.prototype.scrollIntoView = vi.fn() as unknown as typeof window.HTMLElement.prototype.scrollIntoView;

const CHECKOUT_HOLD_KEY = "atlas_guest_checkout_hold";

function seedActiveHold() {
  window.sessionStorage.setItem(
    CHECKOUT_HOLD_KEY,
    JSON.stringify({
      holdId: 42,
      holdListingId: 7,
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

function mockPromoValidateSuccess() {
  return vi.spyOn(globalThis, "fetch").mockImplementation((async (url: unknown) => {
    if (typeof url === "string" && url.includes("/api/promo-codes/validate")) {
      return {
        ok: true,
        json: async () => ({ valid: true, message: "FIRSTSTAY applied — enjoy!", discountAmount: 1500 }),
      } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  }) as typeof fetch);
}

async function renderPage() {
  const result = render(
    <MemoryRouter initialEntries={["/homes/atlas-prop/atlas-unit/checkout"]}>
      <BookingProvider>
        <GuestDetailsPage />
      </BookingProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.getElementById("gd-details-form")).toBeInTheDocument());
  return result;
}

async function openPromoAndApply(code: string) {
  fireEvent.click(screen.getByRole("button", { name: /promo code/i }));
  const input = screen.getByTestId("guest-booking-promo") as HTMLInputElement;
  fireEvent.change(input, { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
  await waitFor(() => expect(screen.getByTestId("promo-savings-chip")).toBeInTheDocument());
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  seedActiveHold();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("TASK-102118 promo savings chip", () => {
  test("no chip renders before a coupon is applied", async () => {
    mockPromoValidateSuccess();
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /promo code/i }));
    expect(screen.queryByTestId("promo-savings-chip")).not.toBeInTheDocument();
  });

  test("applying a coupon renders a green chip with the exact rupee savings", async () => {
    mockPromoValidateSuccess();
    await renderPage();
    await openPromoAndApply("firststay");

    const chip = screen.getByTestId("promo-savings-chip");
    // celebratory copy names the code and the savings
    expect(chip.textContent).toMatch(/FIRSTSTAY applied/i);
    expect(chip.textContent).toMatch(/You saved/i);
    // exact figure comes from the pricing code's discountAmount (1500) — never recomputed here
    expect(chip.textContent).toContain("₹1,500");
    expect(chip).toHaveAttribute("role", "status");
  });

  test("remove (x) clears the coupon via the existing clear path", async () => {
    mockPromoValidateSuccess();
    await renderPage();
    await openPromoAndApply("firststay");

    fireEvent.click(screen.getByTestId("promo-savings-remove"));

    await waitFor(() => expect(screen.queryByTestId("promo-savings-chip")).not.toBeInTheDocument());
    expect((screen.getByTestId("guest-booking-promo") as HTMLInputElement).value).toBe("");
    // no confirmed promo row lingers in the totals
    expect(screen.queryByTestId("promo-confirmed-row")).not.toBeInTheDocument();
    // Apply CTA returns to its un-applied label
    expect(screen.getByRole("button", { name: /^apply$/i })).toBeInTheDocument();
  });
});
