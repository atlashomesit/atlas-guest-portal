import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BookingConfirmationPage from "./BookingConfirmationPage";
import { settle } from "../test/settle";

vi.mock("../lib/events", () => ({ track: vi.fn() }));
vi.mock("../components/SEO", () => ({ default: () => null }));
vi.mock("../components/WeatherWidget", () => ({ default: () => null }));
vi.mock("../config/contact", () => ({
  getContactEmail: () => "",
  getContactPhone: () => "",
  hasHostContact: () => false,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const baseSummary = {
  bookingId: 101,
  listingId: 777,
  guestId: 3001,
  guestName: "Test Guest",
  propertyName: "Atlas Stay",
  listingName: "Atlas Stay",
  checkinDate: "2026-05-12",
  checkoutDate: "2026-05-14",
  nights: 2,
  status: "Cancelled",
  propertyAddress: "Somewhere",
  propertyPhone: "+919999999999",
  checkinInstructions: "Front desk",
  currency: "INR",
  totalAmount: 5000,
  wifiVisible: false,
};

async function renderWith(extra: Record<string, unknown>) {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse({ ...baseSummary, ...extra });
    if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
    if (url.includes("/modification-requests") || url.includes("/add-ons")) return jsonResponse([]);
    return jsonResponse({});
  });
  render(
    <MemoryRouter initialEntries={["/booking/101?t=test-token"]}>
      <Routes>
        <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await settle();
  await settle();
}

describe("PAY-009 refund status tracker on the guest booking page", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("a processed refund shows amount, sent-to-bank badge, dates and the ARN Razorpay sent", async () => {
    await renderWith({
      refunds: [
        {
          amount: 2500,
          status: "processed",
          initiatedAtUtc: "2026-10-15T06:00:00Z",
          processedAtUtc: "2026-10-17T06:00:00Z",
          bankReference: "74332100123456789012345",
        },
      ],
    });
    const card = screen.getByTestId("refund-status-tracker");
    expect(screen.getByTestId("refund-amount").textContent).toContain("2,500");
    expect(screen.getByTestId("refund-status-badge").textContent).toBe("Sent to your bank");
    expect(screen.getByTestId("refund-initiated").textContent).toBe("15 Oct 2026");
    expect(screen.getByTestId("refund-processed").textContent).toBe("17 Oct 2026");
    expect(screen.getByTestId("refund-bank-reference").textContent).toBe("74332100123456789012345");
    expect(card.textContent).toContain("5–7 business days");
    // Never over-claims: Atlas has no signal from the bank itself.
    expect(card.textContent).not.toMatch(/credited/i);
  });

  test("a processed refund without a reference says 'Not available yet' instead of inventing one", async () => {
    await renderWith({
      refunds: [{ amount: 2500, status: "processed", initiatedAtUtc: "2026-10-15T06:00:00Z", processedAtUtc: null, bankReference: null }],
    });
    expect(screen.getByTestId("refund-bank-reference").textContent).toBe("Not available yet");
    expect(screen.queryByTestId("refund-processed")).toBeNull();
  });

  test("a processing refund shows the bank window and no reference row", async () => {
    await renderWith({
      refunds: [{ amount: 1800, status: "processing", initiatedAtUtc: "2026-10-15T06:00:00Z", bankReference: "SHOULDNOTSHOW" }],
    });
    expect(screen.getByTestId("refund-status-badge").textContent).toBe("Processing by bank");
    expect(screen.queryByTestId("refund-bank-reference")).toBeNull();
    expect(document.body.textContent).not.toContain("SHOULDNOTSHOW");
  });

  test("an unknown status reads 'Status unavailable', never a guessed state", async () => {
    await renderWith({ refunds: [{ amount: 1800, status: "some_future_state", initiatedAtUtc: "2026-10-15T06:00:00Z" }] });
    expect(screen.getByTestId("refund-status-badge").textContent).toBe("Status unavailable");
  });

  test("no refunds (or an older API without the field) renders no tracker", async () => {
    await renderWith({});
    expect(screen.queryByTestId("refund-status-tracker")).toBeNull();
  });
});
