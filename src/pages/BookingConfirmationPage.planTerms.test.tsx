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
  status: "Confirmed",
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

describe("GUEST-029 booking confirmation plan terms", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows the meal inclusion and the accepted Strict cancellation terms in plain words, never the internal plan name", async () => {
    await renderWith({ ratePlanName: "Atlas501_PH . Double", mealPlanCode: "CP", cancellationPolicy: "Strict" });
    expect(screen.getByTestId("confirmation-meal-plan").textContent).toContain("Breakfast included");
    const cancel = screen.getByTestId("confirmation-cancellation-terms");
    expect(cancel.textContent).toContain("Full refund if cancelled 7+ days before check-in");
    expect(cancel.textContent).toContain("No refund within 7 days of check-in.");
    expect(document.body.textContent).not.toContain("Atlas501_PH");
    expect(screen.getByTestId("confirmation-total").textContent).toContain("5,000");
  });

  test("a non-refundable plan says so", async () => {
    await renderWith({ mealPlanCode: "RO", cancellationPolicy: "NonRefundable" });
    expect(screen.getByTestId("confirmation-cancellation-terms").textContent).toContain("Non-refundable rate");
    expect(screen.queryByTestId("confirmation-meal-plan")).toBeNull();
  });

  test("Firm is shown with the Strict terms (the server treats Firm as Strict)", async () => {
    await renderWith({ cancellationPolicy: "Firm" });
    expect(screen.getByTestId("confirmation-cancellation-terms").textContent).toContain("7+ days");
  });

  test("hides the whole block when the summary carries none of the fields", async () => {
    await renderWith({});
    expect(screen.queryByTestId("confirmation-plan-terms")).toBeNull();
  });

  test("an unknown policy or meal code is hidden rather than guessed", async () => {
    await renderWith({ mealPlanCode: "ZZ", cancellationPolicy: "Mystery" });
    expect(screen.queryByTestId("confirmation-plan-terms")).toBeNull();
  });
});
