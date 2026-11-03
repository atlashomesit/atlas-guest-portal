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

const summaryBody = {
  bookingId: 101,
  bookingRef: "ATL-101",
  listingId: 777,
  guestId: 3001,
  guestName: "Test Guest",
  propertyName: "Atlas Hilltop Villa",
  listingName: "Atlas Hilltop Villa",
  checkinDate: "2026-05-12",
  checkoutDate: "2026-05-14",
  nights: 2,
  status: "Confirmed",
  propertyAddress: "12 Lake View Road, Lonavala",
  propertyPhone: "+919999999999",
  checkinInstructions: "Collect keys at the wooden gate.",
  currency: "INR",
  totalAmount: 5000,
  wifiVisible: true,
  wifiName: "Atlas_Hilltop_5G",
  wifiPassword: "secret-wifi-password",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  mealPlanCode: "EP",
  cancellationPolicy: "Moderate",
};

describe("BookingConfirmationPage GUEST-054 offline arrival cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem("booking_101_payment_status", "success");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("persists arrival snapshot to localStorage on online load and renders offline copy with banner when offline", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse(summaryBody);
      if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
      if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
      if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
      return jsonResponse({});
    });

    const firstRender = render(
      <MemoryRouter initialEntries={["/booking/101?t=tok-abc12345"]}>
        <Routes>
          <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await settle();

    expect(screen.getAllByText(/Atlas Hilltop Villa/i).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem("atlas_stay_arrival_cache_101_tok-abc1")).toBeTruthy();
    expect(window.localStorage.getItem("atlas_stay_arrival_cache_101")).toBeTruthy();

    firstRender.unmount();
    cleanup();

    // Simulate offline network rejection on second mount
    vi.mocked(global.fetch).mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });

    render(
      <MemoryRouter initialEntries={["/booking/101?t=tok-abc12345"]}>
        <Routes>
          <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await settle();

    expect(screen.queryByText(/Booking not found/i)).toBeNull();
    const banner = screen.getByTestId("confirmation-offline-cache-banner");
    expect(banner).toHaveTextContent(/Offline copy — showing your last saved stay details/i);
    expect(screen.getAllByText(/12 Lake View Road, Lonavala/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Atlas_Hilltop_5G/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Collect keys at the wooden gate/i).length).toBeGreaterThan(0);
  });

  test("does NOT fall back to cached arrival snapshot on explicit HTTP 404 or 401/403", async () => {
    window.localStorage.setItem(
      "atlas_stay_arrival_cache_101_tok-abc1",
      JSON.stringify({ ...summaryBody, savedAtUtc: new Date().toISOString() }),
    );

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings/101/summary")) {
        return jsonResponse({ code: "NOT_FOUND", message: "Booking not found" }, 404);
      }
      return jsonResponse({});
    });

    render(
      <MemoryRouter initialEntries={["/booking/101?t=tok-abc12345"]}>
        <Routes>
          <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await settle();

    expect(screen.queryByTestId("confirmation-offline-cache-banner")).toBeNull();
    expect(screen.getAllByText(/Booking not found/i).length).toBeGreaterThan(0);
  });
});
