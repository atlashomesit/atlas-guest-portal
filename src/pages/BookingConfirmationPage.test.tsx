import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    await settle();
    expect(screen.getByTestId("payment-failed-card")).toBeInTheDocument();
    const beforeManual = paymentCalls;

    fireEvent.click(screen.getByTestId("check-payment-status-btn"));
    expect(screen.getByText("Checking...")).toBeInTheDocument();
    expect(paymentCalls).toBe(beforeManual + 1);

    releaseManualCheck?.();
    await settle();
    expect(screen.queryByText("Checking...")).not.toBeInTheDocument();
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
    await settle();
    expect(screen.getByTestId("booking-confirmation-page")).toBeInTheDocument();
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
    await settle();
    expect(screen.getByTestId("booking-confirmation-page")).toBeInTheDocument();
    expect(screen.queryByText(/Make your stay even better/i)).not.toBeInTheDocument();
  });
});

describe("BookingConfirmationPage door code access & key card (GUEST-053)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders dedicated Access & Door Code card with 1-tap copy button and lock instructions when doorCode is present", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) {
        return jsonResponse({
          ...summaryBody,
          bookingRef: "ATL-101",
          doorCode: "7890",
          checkinInstructions: "Turn the keypad dial after code.",
        });
      }
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
      return jsonResponse({});
    });

    renderPage("/booking/101?t=tok-access");
    await settle();

    // Dedicated Access & Door Code card is rendered
    const card = screen.getByTestId("access-door-code-card");
    expect(card).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Access & Door Code" })).toBeInTheDocument();
    expect(screen.getByText("7890")).toBeInTheDocument();
    expect(screen.getByTestId("door-lock-instructions")).toHaveTextContent(/Turn the keypad dial after code/i);

    // Primary CTA changes to "✓ Checked In — View Door & Key Access"
    expect(screen.getByText("✓ Checked In — View Door & Key Access")).toBeInTheDocument();

    // 1-tap copy button copies code and provides visual confirmation
    const copyBtn = screen.getByTestId("copy-door-code-btn");
    expect(copyBtn).toHaveTextContent("Copy Code");
    fireEvent.click(copyBtn);
    await settle();

    expect(writeTextMock).toHaveBeenCalledWith("7890");
    expect(screen.getByTestId("copy-door-code-btn")).toHaveTextContent("✓ Copied!");
    expect(screen.getByTestId("door-code-copied-confirmation")).toHaveTextContent("Copied to clipboard");
  });

  test("does not render door code card and shows standard check-in CTA when doorCode is absent", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) {
        return jsonResponse({
          ...summaryBody,
          bookingRef: "ATL-101",
          doorCode: undefined,
        });
      }
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
      return jsonResponse({});
    });

    renderPage("/booking/101?t=tok-access");
    await settle();

    expect(screen.queryByTestId("access-door-code-card")).not.toBeInTheDocument();
    expect(screen.queryByText("✓ Checked In — View Door & Key Access")).not.toBeInTheDocument();
    expect(screen.getByText("Complete Web Check-In")).toBeInTheDocument();
  });
});

describe("BookingConfirmationPage Wi-Fi copy + scan-to-connect (GUEST-039)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("Wi-Fi card has Copy for network and password, and a Scan to Connect QR with the WIFI: payload", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) {
        return jsonResponse({ ...summaryBody, bookingRef: "ATL-101", wifiVisible: true, wifiName: "LakeLoft-Guest", wifiPassword: "pass-1234" });
      }
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
      return jsonResponse({});
    });

    renderPage("/booking/101?t=tok-wifi");
    await settle();

    fireEvent.click(screen.getByTestId("copy-wifi-password-btn"));
    await settle();
    expect(writeTextMock).toHaveBeenCalledWith("pass-1234");
    expect(screen.getByTestId("copy-wifi-password-btn")).toHaveTextContent("Copied! ✓");

    fireEvent.click(screen.getByTestId("copy-wifi-name-btn"));
    await settle();
    expect(writeTextMock).toHaveBeenCalledWith("LakeLoft-Guest");

    expect(screen.queryByTestId("wifi-qr-card")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wifi-scan-to-connect-btn"));
    expect(screen.getByTestId("wifi-qr-payload")).toHaveAttribute("data-payload", "WIFI:S:LakeLoft-Guest;T:WPA;P:pass-1234;;");
  });

  test("no Wi-Fi Copy or QR while the details are not visible yet", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse({ ...summaryBody, bookingRef: "ATL-101", wifiVisible: false, wifiName: "Hidden", wifiPassword: "hidden" });
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
      return jsonResponse({});
    });
    renderPage("/booking/101?t=tok-wifi");
    await settle();
    expect(screen.queryByTestId("copy-wifi-password-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wifi-scan-to-connect-btn")).not.toBeInTheDocument();
  });
});

describe("BookingConfirmationPage security-deposit hold status (PAY-006)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockSummary = (extra: Record<string, unknown>) =>
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse({ ...summaryBody, bookingRef: "ATL-101", ...extra });
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
      return jsonResponse({});
    });

  test("shows the hold status, amount and bank-authorization countdown when the summary carries a hold", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    mockSummary({ depositHold: { status: "Authorized", amountInr: 5000, holdExpiresAtUtc: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString() } });
    renderPage("/booking/101?t=tok-dep");
    await settle();
    expect(screen.getByTestId("guest-deposit-hold-status")).toHaveTextContent("Held on your card");
    expect(screen.getByTestId("guest-deposit-hold-detail")).toHaveTextContent("₹5,000");
    expect(screen.getByTestId("guest-deposit-hold-countdown")).toHaveTextContent(/3 days/);
  });

  test("shows no deposit card when the booking has no hold", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    mockSummary({});
    renderPage("/booking/101?t=tok-dep");
    await settle();
    expect(screen.queryByTestId("guest-deposit-hold-card")).not.toBeInTheDocument();
  });
});
