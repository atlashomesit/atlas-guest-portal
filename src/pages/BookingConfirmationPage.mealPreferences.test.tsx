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

const mealBlock = (offered: boolean) => ({
  offered,
  dietaryTags: ["Jain"],
  preferredBreakfastTime: "08:30 AM",
  earlyPackedBreakfast: false,
  foodAllergies: "peanuts",
  options: {
    dietaryTags: [
      { id: "Veg", label: "Vegetarian", description: "" },
      { id: "Jain", label: "Jain", description: "" },
    ],
    breakfastTimeSlots: [{ id: "08:30 AM", label: "8:30 AM", description: "" }],
    maxFoodAllergiesLength: 1000,
  },
});

const baseSummary = {
  bookingId: 101,
  bookingRef: "ATL-101",
  listingId: 777,
  guestId: 3001,
  guestName: "Test Guest",
  propertyName: "Atlas Stay",
  listingName: "Atlas Stay",
  checkinDate: "2026-05-12",
  checkoutDate: "2026-05-14",
  nights: 2,
  status: "Confirmed",
  propertyAddress: "12 Lake View Road",
  propertyPhone: "+919999999999",
  checkinInstructions: "Front desk",
  currency: "INR",
  totalAmount: 5000,
  wifiVisible: false,
  cancellationPolicy: "Moderate",
};

function renderWith(summary: Record<string, unknown>) {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse(summary);
    if (url.includes("/modification-requests")) return jsonResponse([]);
    if (url.includes("/add-ons")) return jsonResponse([]);
    if (url.includes("/payment-status")) return jsonResponse({ status: "Paid" });
    return jsonResponse({});
  });
  window.sessionStorage.setItem("booking_101_payment_status", "success");
  render(
    <MemoryRouter initialEntries={["/booking/101?t=tok-abc"]}>
      <Routes>
        <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BookingConfirmationPage BNB-009 meal preferences", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("a room-only villa booking does not ask about breakfast", async () => {
    renderWith({ ...baseSummary, mealPlanCode: "RO", mealPreferences: mealBlock(false) });
    await settle();
    expect(screen.getByTestId("confirmation-plan-terms")).toBeInTheDocument();
    expect(screen.queryByTestId("guest-dietary-selector")).not.toBeInTheDocument();
  });

  test("a booking whose summary says to ask shows the selector, pre-filled from the summary", async () => {
    renderWith({ ...baseSummary, mealPlanCode: "CP", mealPreferences: mealBlock(true) });
    await settle();
    expect(screen.getByTestId("guest-dietary-selector")).toBeInTheDocument();
    expect(screen.getByTestId("dietary-option-Jain").querySelector("input")).toBeChecked();
    expect((screen.getByTestId("dietary-notes-input") as HTMLTextAreaElement).value).toBe("peanuts");
  });

  test("an older API without the meal block shows no selector", async () => {
    renderWith({ ...baseSummary, mealPlanCode: "CP" });
    await settle();
    expect(screen.queryByTestId("guest-dietary-selector")).not.toBeInTheDocument();
  });
});
