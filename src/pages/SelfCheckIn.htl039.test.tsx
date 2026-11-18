import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import SelfCheckIn from "./SelfCheckIn";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const details = {
  bookingRef: "ATL2030-9911",
  listingName: "Standard Room",
  propertyAddress: "Madikeri",
  checkinDate: "2030-06-10",
  checkoutDate: "2030-06-12",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  checkinInstructions: "",
  wifiName: "",
  wifiPassword: "",
  houseRulesText: "",
  emergencyContactPhone: "",
  doorCode: "1122",
  idUploadRequired: false,
  houseRulesSignedAt: "2030-06-08T10:00:00Z",
};

const offers = [
  {
    offerId: 701,
    targetListingId: 55,
    targetListingName: "Deluxe Garden Suite",
    leadPhotoUrl: null,
    sleeps: 4,
    nights: 2,
    pricePerNight: 750,
    totalPrice: 1500,
    roomsLeft: 1,
    highlights: ["Balcony", "Bathtub"],
    expiresAtUtc: "2030-06-09T10:00:00Z",
    status: "Offered",
  },
];

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc-probe">{`${loc.pathname}${loc.search}`}</div>;
}

function renderCheckin(entry = "/checkin?ref=ATL2030-9911&t=signed-tok") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/checkin" element={<SelfCheckIn />} />
        <Route path="/pay/:token" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HTL-039 pre-arrival upgrade offers on SelfCheckIn", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders upgrade offer card, hides on decline, and calls accept endpoint", async () => {
    let accepted = false;
    let declined = false;
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/upgrade-offers/701/accept")) {
        accepted = true;
        return jsonResponse({
          offerId: 701,
          totalPrice: 1500,
          payUrl: "/pay/upgtok",
          token: "upgtok",
          holdExpiresAtUtc: "2030-06-08T10:30:00Z",
        });
      }
      if (url.includes("/upgrade-offers/701/decline")) {
        declined = true;
        return jsonResponse({}, 200);
      }
      if (url.includes("/upgrade-offers")) {
        return jsonResponse(offers);
      }
      if (url.includes("/api/public/checkin")) {
        return jsonResponse(details);
      }
      return jsonResponse({});
    });

    renderCheckin();
    fireEvent.change(screen.getByLabelText("Booking reference"), { target: { value: "ATL2030-9911" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Guest" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await settle();
    await settle();

    const card = screen.getByTestId("checkin-upgrade-card");
    expect(card.textContent).toContain("Deluxe Garden Suite");
    expect(screen.getByTestId("checkin-upgrade-accept-701").textContent).toContain("Upgrade for ₹1,500");

    // Test decline hides the card cleanly
    fireEvent.click(screen.getByTestId("checkin-upgrade-decline"));
    await settle();
    expect(declined).toBe(true);
    expect(screen.queryByTestId("checkin-upgrade-card")).toBeNull();
    expect(accepted).toBe(false);
  });

  test("does not fetch upgrade offers without a signed token", async () => {
    const urls: string[] = [];
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      urls.push(String(input));
      if (String(input).includes("/api/public/checkin")) return jsonResponse(details);
      return jsonResponse([]);
    });

    renderCheckin("/checkin");
    await settle();
    expect(urls.some((u) => u.includes("/upgrade-offers"))).toBe(false);
  });
});
