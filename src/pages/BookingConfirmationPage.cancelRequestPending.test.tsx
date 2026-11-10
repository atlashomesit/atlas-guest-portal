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

const summary = {
  bookingId: 101, listingId: 777, guestId: 3001, guestName: "Test Guest", propertyName: "Atlas Stay", listingName: "Atlas Stay",
  checkinDate: "2026-12-12", checkoutDate: "2026-12-14", nights: 2, status: "Confirmed", propertyAddress: "Somewhere",
  propertyPhone: "+919999999999", checkinInstructions: "Front desk", currency: "INR", totalAmount: 5000, wifiVisible: false,
};

const pendingCancellation = (note: string) => ({
  id: 9, requestedCheckinDateUtc: "2026-12-12T00:00:00Z", requestedCheckoutDateUtc: "2026-12-14T00:00:00Z",
  requestedGuestCount: null, note, status: "Pending", createdAtUtc: "2026-11-11T00:00:00Z", isCancellation: false,
});

async function renderWith(requests: unknown[]) {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse(summary);
    if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
    if (url.includes("/modification-requests")) return jsonResponse(requests);
    if (url.includes("/add-ons")) return jsonResponse([]);
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

describe("G3 journey 12: a cancellation request already sent, seen on a later visit", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("shows the request as received and does not offer the request button a second time", async () => {
    await renderWith([pendingCancellation("CANCELLATION_REQUEST — Change of plans")]);
    expect(screen.queryByTestId("request-cancellation-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("cancellation-refund-policy-link")).toBeInTheDocument();
  });

  test("never shows the internal marker; the guest sees only what they typed", async () => {
    await renderWith([pendingCancellation("CANCELLATION_REQUEST — Change of plans")]);
    expect(document.body.textContent).not.toMatch(/CANCELLATION_REQUEST/);
    expect(screen.getByText(/Your note: Change of plans/)).toBeInTheDocument();
  });

  test("a request sent with no reason shows no note at all", async () => {
    await renderWith([pendingCancellation("CANCELLATION_REQUEST — Guest requested cancellation")]);
    expect(document.body.textContent).not.toMatch(/CANCELLATION_REQUEST|Guest requested cancellation/);
    expect(screen.queryByText(/Your note:/)).not.toBeInTheDocument();
  });

  test("with no request on file the request button is still offered", async () => {
    await renderWith([]);
    expect(screen.getByTestId("request-cancellation-btn")).toBeInTheDocument();
  });
});
