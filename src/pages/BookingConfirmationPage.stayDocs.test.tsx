import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Same fixture shape used by TASK-102114 — keep parity for downstream test audits.
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
  checkinInstructions: "Self check-in. Lockbox code shared on arrival day.",
  currency: "INR",
  totalAmount: 18499,
  wifiVisible: true,
  wifiName: "Lakeview Guest",
  wifiPassword: "Welcome2026",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  guidebookCheckoutChecklistText: "Strip beds. Take out trash. Return keys.",
  guidebookTrashParkingText: "Bins behind the kitchen door. One parking spot on the right.",
  nearbyLandmarks: ["Lake Park — 5 min walk", "Cafe Lotus — 200 m"],
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

describe("BookingConfirmationPage TASK-102057 stay documents", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders Stay Receipt + Stay Guide buttons on a confirmed booking", async () => {
    window.sessionStorage.setItem("booking_102057_payment_status", "success");
    mockSummaryFetch();
    renderPage();
    expect(await screen.findByTestId("booking-confirmation-page")).toBeInTheDocument();
    expect(screen.getByTestId("download-receipt-btn")).toBeInTheDocument();
    expect(screen.getByTestId("download-stay-guide-btn")).toBeInTheDocument();
  });

  test("clicking Download Stay Receipt opens a new window with the receipt html", async () => {
    window.sessionStorage.setItem("booking_102057_payment_status", "success");
    mockSummaryFetch();

    // Capture the HTML pushed into the new window so we can assert it.
    const openMock = vi.fn().mockImplementation(() => {
      const fakeDoc = {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          // Stash on the fake doc for inspection
          (fakeDoc as unknown as { _written?: string })._written = html;
        }),
        close: vi.fn(),
        readyState: "complete",
      };
      return { document: fakeDoc, focus: vi.fn(), print: vi.fn(), addEventListener: vi.fn() } as unknown as Window;
    });
    vi.spyOn(window, "open").mockImplementation(openMock);

    renderPage();
    const btn = await screen.findByTestId("download-receipt-btn");
    fireEvent.click(btn);

    expect(openMock).toHaveBeenCalledTimes(1);
    const writtenHtml = (openMock.mock.results[0].value as { document: { _written?: string } }).document._written ?? "";
    expect(writtenHtml).toContain("Stay Receipt");
    expect(writtenHtml).toContain("#102057");
    expect(writtenHtml).toContain("Lakeview Villa");
    expect(writtenHtml).toContain("Anita Tester");
    expect(writtenHtml).toContain("2026-10-12");
    expect(writtenHtml).toContain("₹18,499");
    expect(writtenHtml).toContain("@media print");
  });

  test("clicking Download Stay Guide opens a new window with WiFi, house rules and host contacts", async () => {
    window.sessionStorage.setItem("booking_102057_payment_status", "success");
    mockSummaryFetch();

    const openMock = vi.fn().mockImplementation(() => {
      const fakeDoc = {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          (fakeDoc as unknown as { _written?: string })._written = html;
        }),
        close: vi.fn(),
        readyState: "complete",
      };
      return { document: fakeDoc, focus: vi.fn(), print: vi.fn(), addEventListener: vi.fn() } as unknown as Window;
    });
    vi.spyOn(window, "open").mockImplementation(openMock);

    renderPage();
    const btn = await screen.findByTestId("download-stay-guide-btn");
    fireEvent.click(btn);

    expect(openMock).toHaveBeenCalledTimes(1);
    const writtenHtml = (openMock.mock.results[0].value as { document: { _written?: string } }).document._written ?? "";
    expect(writtenHtml).toContain("Stay Guide");
    expect(writtenHtml).toContain("Lakeview Guest");
    expect(writtenHtml).toContain("Welcome2026");
    expect(writtenHtml).toContain("Self check-in. Lockbox code shared on arrival day.");
    expect(writtenHtml).toContain("12 Lake View Road, Hyderabad");
    expect(writtenHtml).toContain("Strip beds.");
    expect(writtenHtml).toContain("+919999999999");
  });

  test("buttons are hidden on cancelled bookings", async () => {
    window.sessionStorage.setItem("booking_102057_payment_status", "success");
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/102057/summary")) return jsonResponse({ ...summaryBody, status: "Cancelled" });
      if (url.includes("/api/public/bookings/102057/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/102057/payment-status")) return jsonResponse({ status: "Paid" });
      return jsonResponse({});
    });

    renderPage();
    await waitFor(() => expect(screen.queryByTestId("download-receipt-btn")).not.toBeInTheDocument());
    expect(screen.queryByTestId("download-stay-guide-btn")).not.toBeInTheDocument();
  });
});