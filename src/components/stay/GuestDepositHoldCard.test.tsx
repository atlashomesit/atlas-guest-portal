import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import GuestDepositHoldCard, { depositHoldTimeLeft } from "./GuestDepositHoldCard";

afterEach(cleanup);

const now = Date.parse("2026-11-01T10:00:00Z");
const view = (hold: Parameters<typeof GuestDepositHoldCard>[0]["hold"]) =>
  render(
    <MemoryRouter>
      <GuestDepositHoldCard hold={hold} bookingId={55} token="tok" nowMs={now} />
    </MemoryRouter>,
  );

describe("PAY-006 guest deposit-hold status", () => {
  it("time-left wording", () => {
    expect(depositHoldTimeLeft("2026-11-04T14:00:00Z", now)).toBe("3 days 4 hours left");
    expect(depositHoldTimeLeft("2026-11-02T10:00:00Z", now)).toBe("1 day left");
    expect(depositHoldTimeLeft("2026-11-01T11:00:00Z", now)).toBe("1 hour left");
    expect(depositHoldTimeLeft("2026-11-01T10:12:00Z", now)).toBe("12 minutes left");
    expect(depositHoldTimeLeft("2026-11-01T09:00:00Z", now)).toBe("ended");
    expect(depositHoldTimeLeft(undefined, now)).toBeNull();
  });

  it("Authorized: says the card is held, not charged, with the live expiry countdown", () => {
    view({ status: "Authorized", amountInr: 5000, holdExpiresAtUtc: "2026-11-04T14:00:00Z" });
    expect(screen.getByTestId("guest-deposit-hold-status")).toHaveTextContent("Held on your card");
    expect(screen.getByTestId("guest-deposit-hold-detail")).toHaveTextContent("₹5,000 is held on your card, not charged");
    expect(screen.getByTestId("guest-deposit-hold-countdown")).toHaveTextContent("3 days 4 hours left");
    expect(screen.queryByTestId("guest-deposit-hold-link")).toBeNull();
  });

  // PAY-028 (guest half): the old promise "released after your stay if there is no damage" was false (releasing is bookkeeping; the bank frees the
  // money when Razorpay lets the hold lapse). The card says the truth: held not charged, covers damage claims until a date, then the bank frees it.
  it("Authorized with a covers-until date: says the hold covers damage claims until that date, then the bank frees it", () => {
    view({ status: "Authorized", amountInr: 5000, holdExpiresAtUtc: "2026-11-04T14:00:00Z", coversUntilUtc: "2026-11-14T08:30:00Z" });
    const detail = screen.getByTestId("guest-deposit-hold-detail");
    expect(detail).toHaveTextContent("₹5,000 is held on your card, not charged.");
    expect(detail).toHaveTextContent(/It covers damage claims until 14 Nov 2026/);
    expect(detail).toHaveTextContent("After that, or when your host releases it, your bank frees it; your bank may take a few more days to show it.");
    expect(detail.textContent).not.toMatch(/released after your stay|after check-?out/i);
  });

  it("Authorized without a covers-until date (an older API): a sentence with no date, and still no false promise", () => {
    view({ status: "Authorized", amountInr: 5000, holdExpiresAtUtc: "2026-11-04T14:00:00Z" });
    const detail = screen.getByTestId("guest-deposit-hold-detail");
    expect(detail).toHaveTextContent("It covers damage claims while it lasts.");
    expect(detail.textContent).not.toMatch(/until \d|released after your stay|after check-?out/i);
    expect(detail).toHaveTextContent("your bank frees it; your bank may take a few more days to show it.");
  });

  it("Captured: names the charged part and does not promise the rest is released; Released: your host released it, bank may be slow", () => {
    const { unmount } = view({ status: "Captured", amountInr: 5000, capturedAmountInr: 1200 });
    expect(screen.getByTestId("guest-deposit-hold-detail")).toHaveTextContent("The rest of the hold is not charged.");
    expect(screen.getByTestId("guest-deposit-hold-detail").textContent).not.toMatch(/The rest is released/);
    unmount();
    view({ status: "Released", amountInr: 5000 });
    expect(screen.getByTestId("guest-deposit-hold-detail")).toHaveTextContent("Your host has released the ₹5,000 hold. Nothing was charged. Your bank frees the money and may take a few more days to show it.");
  });

  it("Captured: names the charged part; Released: says nothing was charged; no countdown for either", () => {
    const { unmount } = view({ status: "Captured", amountInr: 5000, capturedAmountInr: 1200, holdExpiresAtUtc: "2026-11-04T14:00:00Z" });
    expect(screen.getByTestId("guest-deposit-hold-detail")).toHaveTextContent("₹1,200 of the ₹5,000 hold was charged");
    expect(screen.queryByTestId("guest-deposit-hold-countdown")).toBeNull();
    unmount();
    view({ status: "Released", amountInr: 5000 });
    expect(screen.getByTestId("guest-deposit-hold-status")).toHaveTextContent("Released");
    expect(screen.getByTestId("guest-deposit-hold-detail")).toHaveTextContent("Nothing was charged");
  });

  it("AuthorizationPending links to the deposit page with the booking-link token", () => {
    view({ status: "AuthorizationPending", amountInr: 2500 });
    expect(screen.getByTestId("guest-deposit-hold-link")).toHaveAttribute("href", "/booking/55/deposit?t=tok");
  });

  it("renders nothing when the booking has no hold", () => {
    const { container } = view(null);
    expect(container).toBeEmptyDOMElement();
  });
});
