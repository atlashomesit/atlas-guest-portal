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
  getContactPhone: () => "+919999999999",
  hasHostContact: () => true,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const baseSummary = {
  bookingId: 202,
  listingId: 88,
  guestId: 3001,
  guestName: "Meera Nair",
  propertyName: "Hilltop Retreat",
  listingName: "Cedar Cottage",
  checkinDate: "2030-06-10",
  checkoutDate: "2030-06-12",
  nights: 2,
  status: "Confirmed",
  propertyAddress: "Madikeri",
  propertyPhone: "+919999999999",
  checkinInstructions: "Front desk",
  currency: "INR",
  totalAmount: 9500,
  wifiVisible: false,
};

async function renderWithSummary(extra: Record<string, unknown>, addOns: unknown[] = []) {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/guest/bookings/202/summary")) return jsonResponse({ ...baseSummary, ...extra });
    if (url.includes("/bookings/202/payment-status")) return jsonResponse({ status: "Paid" });
    if (url.includes("/modification-requests")) return jsonResponse([]);
    if (url.includes("/add-ons")) return jsonResponse(addOns);
    return jsonResponse({});
  });
  render(
    <MemoryRouter initialEntries={["/booking/202?t=test-token"]}>
      <Routes>
        <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await settle();
  await settle();
}

describe("MRP-041 stay package on BookingConfirmationPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders 'Included in your stay' items and hides already-included add-ons from post-pay upsells", async () => {
    await renderWithSummary(
      {
        includedPackage: {
          title: "Weekend Spa Escape",
          description: "Relaxing stay package",
          items: [
            { addOnServiceId: 501, label: "Couple Spa", basis: "per_stay", quantity: 1 },
            { addOnServiceId: null, label: "Late Checkout", basis: "per_stay", quantity: 1 },
          ],
        },
      },
      [
        { addOnServiceId: 501, name: "Couple Spa", price: 2000, priceType: "per_booking" },
        { addOnServiceId: 502, name: "Airport Pickup", price: 1500, priceType: "per_booking" },
      ],
    );

    const pkgSection = screen.getByTestId("confirmation-included-package");
    expect(pkgSection.textContent).toContain("Included in your stay");
    expect(pkgSection.textContent).toContain("Weekend Spa Escape");
    expect(pkgSection.textContent).toContain("Couple Spa (per stay)");
    expect(pkgSection.textContent).toContain("Late Checkout (per stay)");
    // Couple Spa (id 501) is already included, so only Airport Pickup should appear in upsells
    expect(screen.getByText("Airport Pickup")).toBeTruthy();
    expect(screen.queryByText(/Request · INR\s+2000/)).toBeNull();
  });

  test("hides included section when booking has no package", async () => {
    await renderWithSummary({ includedPackage: null });
    expect(screen.queryByTestId("confirmation-included-package")).toBeNull();
  });
});
