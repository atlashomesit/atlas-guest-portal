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
  status: "PaymentPending",
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
    if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Pending" });
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

describe("PAY-010 guest booking page after 'I have paid' on a UPI host", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("says it is waiting for the HOST to confirm, never that it is paid or confirmed", async () => {
    await renderWith({ awaitingHostPaymentConfirmation: true });
    const banner = screen.getByTestId("upi-awaiting-host-confirmation");
    expect(banner.textContent).toContain("Waiting for the host to confirm your payment");
    expect(banner.textContent).toContain("No need to pay again");
    expect(screen.queryByTestId("payment-polling-status")).toBeNull();
  });

  test("an older API without the field shows no UPI waiting banner", async () => {
    await renderWith({});
    expect(screen.queryByTestId("upi-awaiting-host-confirmation")).toBeNull();
  });
});
