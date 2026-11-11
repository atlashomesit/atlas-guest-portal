/**
 * CHN-012 (guest half): the sister-property cards. Read-only suggestion; price is the API's FinalAmount as returned.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import SisterPropertySpillover from "./SisterPropertySpillover";
import type { SisterSpillover } from "@/api/sisterAvailabilityClient";

const DATA: SisterSpillover = {
  sourceSoldOut: true,
  checkIn: "2026-11-06",
  checkOut: "2026-11-08",
  nights: 2,
  guests: 2,
  properties: [
    {
      propertyId: 8,
      propertyName: "Atlas Homes Coorg",
      city: "Madikeri",
      state: "Karnataka",
      distanceKm: 12.4,
      listings: [
        { listingId: 81, listingName: "Garden Suite", maxGuests: 3, coverPhotoUrl: null, currency: "INR", totalAmount: 11800.5, averagePerNight: 5900.25 },
        { listingId: 82, listingName: "Hill <b>View</b> Room", maxGuests: 2, coverPhotoUrl: null, currency: "INR", totalAmount: 9000, averagePerNight: 4500 },
      ],
    },
  ],
};

function Probe() {
  const location = useLocation();
  return <div data-testid="probe">{`${location.pathname}${location.search}`}</div>;
}

function renderCards(props: Partial<React.ComponentProps<typeof SisterPropertySpillover>> = {}) {
  return render(
    <MemoryRouter initialEntries={["/homes/atlas-homes-madikeri/7"]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <SisterPropertySpillover data={DATA} checkIn="2026-11-06" checkOut="2026-11-08" guests={2} {...props} />
              <Probe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe("SisterPropertySpillover", () => {
  it("shows the headline, the property, the unit and the API's price exactly as returned", () => {
    renderCards();
    expect(screen.getByTestId("sister-spillover-headline")).toHaveTextContent(
      "This property is full for your dates. Available at our sister property"
    );
    const card = screen.getByTestId("sister-offer-81");
    expect(card).toHaveTextContent("Atlas Homes Coorg");
    expect(card).toHaveTextContent("Madikeri");
    expect(card).toHaveTextContent("Garden Suite");
    expect(card).toHaveTextContent("₹11,800.5"); // FinalAmount untouched: no rounding, no recompute
    expect(card).toHaveTextContent("₹5,900.25");
    expect(card).toHaveTextContent("12.4 km");
  });

  it("renders unit names as text, never as HTML", () => {
    renderCards();
    const card = screen.getByTestId("sister-offer-82");
    expect(card).toHaveTextContent("Hill <b>View</b> Room");
    expect(card.querySelector("b")).toBeNull();
  });

  it("one tap carries the dates and the guest count to that listing", () => {
    renderCards();
    const link = screen.getByTestId("sister-offer-link-81");
    expect(link).toHaveAttribute("href", "/homes/atlas-homes-coorg/81?checkIn=2026-11-06&checkOut=2026-11-08&guests=2");
    fireEvent.click(link);
    expect(screen.getByTestId("probe")).toHaveTextContent("/homes/atlas-homes-coorg/81?checkIn=2026-11-06&checkOut=2026-11-08&guests=2");
  });

  it("keeps the marketplace tenant on the link when one is given", () => {
    renderCards({ tenantSlug: "coorg-resort" });
    expect(screen.getByTestId("sister-offer-link-81")).toHaveAttribute(
      "href",
      "/homes/atlas-homes-coorg/81?checkIn=2026-11-06&checkOut=2026-11-08&guests=2&tenant=coorg-resort"
    );
  });

  it("renders nothing when there is no answer, the property is not sold out, or no card came back", () => {
    renderCards({ data: null });
    expect(screen.queryByTestId("sister-property-spillover")).toBeNull();
    cleanup();
    renderCards({ data: { ...DATA, sourceSoldOut: false } });
    expect(screen.queryByTestId("sister-property-spillover")).toBeNull();
    cleanup();
    renderCards({ data: { ...DATA, properties: [] } });
    expect(screen.queryByTestId("sister-property-spillover")).toBeNull();
  });
});
