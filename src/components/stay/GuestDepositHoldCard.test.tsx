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
