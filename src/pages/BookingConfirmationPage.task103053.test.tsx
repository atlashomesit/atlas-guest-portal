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
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Same fixture shape as the TASK-102057 stay-docs spec. hasGstInvoice is absent/false:
// a Confirmed direct booking with no GSTIN-gated manual invoice.
const summaryBody = {
  bookingId: 102057,
  listingId: 777,
  guestId: 3001,
  guestName: "Anita Tester",
  propertyName: "Lakeview Villa",
  listingName: "Lakeview Villa",
  checkinDate: "2026-10-12",
  checkoutDate: "2026-10-15",
  nights: 3,
  status: "Confirmed",
  propertyAddress: "12 Lake View Road, Hyderabad",
  propertyPhone: "+919999999999",
  currency: "INR",
  totalAmount: 18499,
  checkInTime: "14:00",
  checkOutTime: "11:00",
};

function renderPage(path = "/booking/102057?t=test-token") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockSummaryFetch() {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/guest/bookings/102057/summary")) return jsonResponse(summaryBody);
    if (url.includes("/api/public/bookings/102057/modification-requests")) return jsonResponse([]);
    if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
    if (url.includes("/bookings/102057/payment-status")) return jsonResponse({ status: "Paid" });
    return jsonResponse({});
  });
}

describe("TASK-103053: no GST-invoice-within-an-hour promise", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("a Confirmed booking with hasGstInvoice:false renders no 'within 1 hour' promise", async () => {
    window.sessionStorage.setItem("booking_102057_payment_status", "success");
    mockSummaryFetch();
    renderPage();
    await settle();
    expect(screen.getByTestId("booking-confirmation-page")).toBeInTheDocument();
    expect(screen.queryByText(/within 1 hour/i)).toBeNull();
    expect(screen.queryByText(/being generated/i)).toBeNull();
  });
});
