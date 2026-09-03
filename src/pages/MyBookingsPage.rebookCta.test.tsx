import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import MyBookingsPage from "./MyBookingsPage";
import { GuestAuthProvider } from "../contexts/GuestAuthContext";

// TASK-10091: a completed (Past, non-cancelled) stay gets a "Book this home again" CTA that
// coexists with — never replaces — the TASK-4360 review CTA/badge, links to the plain current
// listing detail route (no query params carrying old booking state), and is hidden whenever the
// server has nulled out `listingId` (missing/deleted/unpublished/cross-tenant listing).

vi.mock("../components/SEO", () => ({ default: () => null }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Checkout dates are far in the past / future so tab classification is stable regardless of
// the machine's clock.
const bookings = [
  {
    id: 1,
    bookingRef: "ATL-1",
    propertyName: "Atlas Stay Koramangala",
    listingName: "Sea View Studio",
    checkinDate: "2020-01-02",
    checkoutDate: "2020-01-05",
    status: "CheckedOut",
    totalAmount: 5000,
    token: "tok-past-rebookable",
    reviewed: true,
    listingId: 482,
  },
  {
    id: 2,
    bookingRef: "ATL-2",
    propertyName: "Atlas Stay Koramangala",
    listingName: "Garden Suite",
    checkinDate: "2020-02-02",
    checkoutDate: "2020-02-05",
    status: "CheckedOut",
    totalAmount: 6000,
    token: "tok-past-no-listing",
    reviewed: false,
    // No listingId: server nulls this out for a missing/deleted/unpublished/cross-tenant listing.
  },
  {
    id: 3,
    bookingRef: "ATL-3",
    propertyName: "Atlas Stay Koramangala",
    listingName: "Hilltop Cabin",
    checkinDate: "2099-01-02",
    checkoutDate: "2099-01-05",
    status: "Confirmed",
    totalAmount: 7000,
    token: "tok-upcoming",
    listingId: 999,
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/bookings?guestId=3001&t=magic-token"]}>
      <GuestAuthProvider>
        <Routes>
          <Route path="/bookings" element={<MyBookingsPage />} />
        </Routes>
      </GuestAuthProvider>
    </MemoryRouter>,
  );
}

describe("MyBookingsPage — TASK-10091 rebook CTA", () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings")) return jsonResponse(bookings);
      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("no rebook CTA on the Upcoming tab", async () => {
    renderPage();
    await screen.findByRole("tab", { name: "Past" });
    expect(screen.getByText("Hilltop Cabin")).toBeInTheDocument();
    expect(screen.queryByTestId("my-bookings-rebook-cta")).not.toBeInTheDocument();
  });

  test("Past tab: rebook CTA links to the plain current listing route with no query params, and coexists with the Reviewed badge", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Past" }));

    const ctas = await screen.findAllByTestId("my-bookings-rebook-cta");
    // Only the booking with a server-supplied listingId (id 1) offers the CTA.
    expect(ctas).toHaveLength(1);
    expect(ctas[0]).toHaveTextContent("Book this home again");

    const href = ctas[0].getAttribute("href") ?? "";
    // Current listing detail route (propertySlug + numeric listingId PK), no query string at all —
    // never a reconstructed quote/price/discount/token/hold.
    expect(href).toMatch(/^\/homes\/atlas-stay-koramangala\/482$/);
    expect(href).not.toContain("?");

    // Coexists with — does not replace — the TASK-4360 review state. Booking 1 is already
    // reviewed, so its quiet "Reviewed" badge must still be present alongside the rebook CTA.
    expect(screen.getByTestId("my-bookings-reviewed-badge")).toBeInTheDocument();
  });

  test("Past tab: rebook CTA is suppressed when the server has no public listing to link to", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Past" }));

    // Booking 2 (no listingId) still renders normally, including its own review CTA — just
    // without a rebook link to a dead route.
    await screen.findByText("Garden Suite");
    const reviewCtas = screen.getAllByTestId("my-bookings-review-cta");
    expect(reviewCtas).toHaveLength(1);
    expect(reviewCtas[0].getAttribute("href")).toContain("/review/2");

    // Exactly one rebook CTA total (booking 1); booking 2 has none.
    expect(screen.getAllByTestId("my-bookings-rebook-cta")).toHaveLength(1);
  });
});
