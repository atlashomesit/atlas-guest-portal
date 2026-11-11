import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
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
  bookingId: 101, listingId: 777, guestId: 3001, guestName: "Test Guest",
  propertyName: "Atlas Stay", listingName: "Atlas Stay",
  checkinDate: "2026-11-12", checkoutDate: "2026-11-14", nights: 2, status: "Confirmed",
  propertyAddress: "Somewhere", propertyPhone: "+919999999999", checkinInstructions: "Front desk",
  currency: "INR", totalAmount: 5000, wifiVisible: false,
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
      <Routes><Route path="/booking/:bookingId" element={<BookingConfirmationPage />} /></Routes>
    </MemoryRouter>,
  );
  await settle();
  await settle();
}

describe("HSL-011 dorm gender rule acknowledgement on the confirmation page", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  test("shows a calm line with the date when acknowledged", async () => {
    await renderWith({ dormGenderAckAtUtc: "2026-10-23T10:00:00Z", dormGenderAckPolicy: "FemaleOnly" });
    const line = screen.getByTestId("confirmation-dorm-gender-ack");
    expect(line.textContent).toBe("You confirmed the women-only dorm rule on 23 Oct 2026.");
    expect(line.textContent).not.toMatch(/refund|cancel/i);
  });

  test("shows nothing when there is no acknowledgement", async () => {
    await renderWith({ dormGenderAckAtUtc: null, dormGenderAckPolicy: null });
    expect(screen.queryByTestId("confirmation-dorm-gender-ack")).toBeNull();
  });
});
