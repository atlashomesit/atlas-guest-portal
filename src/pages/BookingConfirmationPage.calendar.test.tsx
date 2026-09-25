import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import BookingConfirmationPage from "./BookingConfirmationPage";

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

// Booking data already shown on screen — check-in time / address / id must be
// reused verbatim by the calendar export (never invented).
const summaryBody = {
  bookingId: 101,
  listingId: 777,
  guestId: 3001,
  guestName: "Test Guest",
  propertyName: "Atlas Stay",
  listingName: "Atlas Stay",
  checkinDate: "2026-05-12",
  checkoutDate: "2026-05-14",
  nights: 2,
  status: "Confirmed",
  propertyAddress: "12 Lake View Road, Hyderabad",
  propertyPhone: "+919999999999",
  checkinInstructions: "Front desk",
  currency: "INR",
  totalAmount: 5000,
  wifiVisible: false,
  checkInTime: "14:00",
  checkOutTime: "11:00",
};

function renderPage(path = "/booking/101?t=test-token") {
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
    if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse(summaryBody);
    if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
    if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
    if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
    return jsonResponse({});
  });
}

describe("BookingConfirmationPage TASK-102114 calendar export", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows both Google Calendar and .ics buttons", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    mockSummaryFetch();
    renderPage();
    expect(await screen.findByTestId("booking-confirmation-page")).toBeInTheDocument();
    expect(screen.getByTestId("confirmation-add-google-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("confirmation-download-ics")).toBeInTheDocument();
  });

  test("Google Calendar link carries check-in time, address and booking id", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    mockSummaryFetch();
    renderPage();
    const link = await screen.findByTestId("confirmation-add-google-calendar");
    const href = (link as HTMLAnchorElement).href;
    expect(href).toContain("calendar.google.com/calendar/render");
    expect(href).toContain("action=TEMPLATE");
    // URLSearchParams encodes spaces as + and / as %2F — normalize before asserting.
    const normalized = decodeURIComponent(href.replace(/\+/g, " "));
    // Floating IST stamps: check-in 12 May 14:00 -> check-out 14 May 11:00
    expect(normalized).toContain("20260512T140000/20260514T110000");
    expect(normalized).toContain("12 Lake View Road, Hyderabad");
    expect(normalized).toContain("101");
  });

  test(".ics download contains check-in time, address and booking id", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    mockSummaryFetch();
    const createObjectURL = vi.fn(() => "blob:mock-ics");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPage();
    expect(await screen.findByTestId("booking-confirmation-page")).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("confirmation-download-ics"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain("DTSTART:20260512T140000");
    expect(text).toContain("DTEND:20260514T110000");
    expect(text).toContain("LOCATION:12 Lake View Road, Hyderabad");
    expect(text).toContain("Booking #101");
    expect(clickSpy).toHaveBeenCalled();
  });
});
