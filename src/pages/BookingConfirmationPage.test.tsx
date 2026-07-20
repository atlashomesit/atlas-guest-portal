import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
  propertyAddress: "Somewhere",
  propertyPhone: "+919999999999",
  checkinInstructions: "Front desk",
  currency: "INR",
  totalAmount: 5000,
  wifiVisible: false,
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

describe("BookingConfirmationPage payment polling", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("payment succeeds after around 4 minutes of polling", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
    let paymentCalls = 0;
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse(summaryBody);
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) {
        paymentCalls += 1;
        if (paymentCalls >= 121) return jsonResponse({ status: "Paid" });
        return jsonResponse({ status: "Pending" });
      }
      return jsonResponse({});
    });

    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(240000);
    });
    expect(paymentCalls).toBeGreaterThanOrEqual(121);
    expect(screen.getByTestId("booking-confirmation-page")).toBeInTheDocument();
    expect(screen.queryByTestId("payment-polling-status")).not.toBeInTheDocument();
    expect(screen.queryByText(/still processing\?/i)).not.toBeInTheDocument();
  });

  test("manual check button triggers immediate status fetch", async () => {
    let paymentCalls = 0;
    let releaseManualCheck: (() => void) | null = null;

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse(summaryBody);
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) {
        paymentCalls += 1;
        if (paymentCalls === 1) {
          return jsonResponse({
            status: "Failed",
            failureReason: "Gateway timeout",
            retryUrl: "https://pay.example/retry",
          });
        }
        return new Promise<Response>((resolve) => {
          releaseManualCheck = () => resolve(jsonResponse({ status: "Failed", retryUrl: "https://pay.example/retry" }));
        });
      }
      return jsonResponse({});
    });

    renderPage();
    expect(await screen.findByTestId("payment-failed-card")).toBeInTheDocument();
    const beforeManual = paymentCalls;

    fireEvent.click(screen.getByTestId("check-payment-status-btn"));
    expect(screen.getByText("Checking...")).toBeInTheDocument();
    expect(paymentCalls).toBe(beforeManual + 1);

    releaseManualCheck?.();
    await waitFor(() => expect(screen.queryByText("Checking...")).not.toBeInTheDocument());
  });

  test("reload uses cached success status and skips polling", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    let paymentStatusCalls = 0;

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse(summaryBody);
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) {
        paymentStatusCalls += 1;
        return jsonResponse({ status: "Pending" });
      }
      return jsonResponse({});
    });

    renderPage();
    expect(await screen.findByTestId("booking-confirmation-page")).toBeInTheDocument();
    expect(paymentStatusCalls).toBe(0);
    expect(screen.queryByTestId("payment-polling-status")).not.toBeInTheDocument();
  });
});

describe("BookingConfirmationPage TASK-5178 add-on upsell", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders without crash when add-ons exist but tenant has no WhatsApp number", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) {
        return jsonResponse({ ...summaryBody, propertyPhone: "" });
      }
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) {
        return jsonResponse([
          {
            addOnServiceId: 1,
            name: "Airport pickup",
            description: "Sedan",
            price: 800,
            priceType: "fixed",
            currency: "INR",
          },
        ]);
      }
      return jsonResponse({});
    });

    renderPage();
    expect(await screen.findByTestId("booking-confirmation-page")).toBeInTheDocument();
    expect(screen.queryByText(/Make your stay even better/i)).not.toBeInTheDocument();
  });
});
