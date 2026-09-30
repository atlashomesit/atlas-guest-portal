import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingProvider } from "@/contexts/BookingContext";
import GuestDetailsPage from "./GuestDetailsPage";
import { _setTenantContextForTests } from "@/tenant/tenantContext";

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

  it("renders 'INR' without GST claim under ADR-0107 (zero GST on top at guest checkout)", async () => {
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


describe("TASK-102661 checkout fee copy", () => {
  afterEach(() => { cleanup(); sessionStorage.clear(); });
  it('shows no fee or fictional discount for an absorbed hold while preserving its final total', async () => {
    _setTenantContextForTests({ slug: "checkout-absorbed", name: "Fee fixture", bookingMode: "ONLINE" });
    sessionStorage.setItem(CHECKOUT_HOLD_KEY, JSON.stringify({
      holdId: 43, holdExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      holdPropertySlug: "fee-home", holdUnitSlug: "fee-unit", holdListingName: "Fee unit",
      checkIn: "2026-10-01", checkOut: "2026-10-03", guests: 2,
      // Legacy widget fallback can retain a derived positive amount even when the API
      // explicitly says the host absorbs the fee. Display must honor raw zero.
      holdPriceBreakdown: { baseAmount: 7000, discountAmount: 0, convenienceFeeAmount: 210,
        finalAmount: 7000, nights: 2, paymentFeeDisplay: { percent: 3, amount: 0 } },
    }));
    const view = render(<MemoryRouter><BookingProvider><GuestDetailsPage /></BookingProvider></MemoryRouter>);
    await waitFor(() => expect(view.container.textContent).toContain('No payment-processing fee.'));
    expect(screen.queryByTestId('fee-info-payment-processing')).not.toBeInTheDocument();
    expect(screen.queryByTestId('price-line-discount-plug')).not.toBeInTheDocument();
    expect(view.container.querySelector('.gd-price-total .num')?.textContent).toContain('7,000');
    cleanup();
    sessionStorage.clear();
  });

  it.each([
    [{ percent: 1.25, amount: 87.5 }, "1.25% payment-processing fee"],
    [{ percent: 1.25, amount: 0 }, "No payment-processing fee."],
    [{ percent: null, amount: 87.5 }, "₹87.50 payment-processing fee"],
    [{ percent: null, amount: null }, "Any payment-processing fee is shown before payment."],
  ])("renders only the hold's fee metadata: %j", async (paymentFeeDisplay, expected) => {
    _setTenantContextForTests({ slug: "checkout-fee", name: "Fee fixture", bookingMode: "ONLINE" });
    sessionStorage.setItem(CHECKOUT_HOLD_KEY, JSON.stringify({
      holdId: 42, holdExpiresAt: new Date(Date.now() + 300_000).toISOString(),
      holdPropertySlug: "fee-home", holdUnitSlug: "fee-unit", holdListingName: "Fee unit",
      checkIn: "2026-10-01", checkOut: "2026-10-03", guests: 2,
      holdPriceBreakdown: { baseAmount: 7000, discountAmount: 0, convenienceFeeAmount: 87.5,
        finalAmount: paymentFeeDisplay.amount === 0 ? 7000 : 7087.5, nights: 2, paymentFeeDisplay },
    }));
    const view = render(<MemoryRouter><BookingProvider><GuestDetailsPage /></BookingProvider></MemoryRouter>);
    await waitFor(() => expect(view.container.querySelector('.gd-trust-row:last-of-type')?.parentElement?.textContent ?? view.container.textContent).toContain(expected));
    expect(view.container.textContent).not.toContain('3% payment processing');
    if (paymentFeeDisplay.amount === null) expect(screen.getByTestId('fee-info-payment-processing')).toBeInTheDocument();
    cleanup();
    sessionStorage.clear();
  });
});
