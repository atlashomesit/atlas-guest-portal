import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import MyBookingsPage from "./MyBookingsPage";
import { GuestAuthProvider } from "../contexts/GuestAuthContext";

// TASK-4360 AC6: assert the in-portal "Rate your stay" CTA renders for a checked-out,
// not-yet-reviewed booking on the Past tab and is absent for an upcoming booking; and
// AC2: an already-reviewed past stay shows a quiet "✓ Reviewed" state instead of the CTA.
// (The guest portal has no Playwright/e2e harness — its behavioural coverage is vitest;
// this is the "extension of an existing MyBookings spec" the task allows.)

vi.mock("../components/SEO", () => ({ default: () => null }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Checkout dates are far in the past / future so tab classification (checkout < today =>
// Past, checkout >= today => Upcoming) is stable regardless of the machine's clock.
const bookings = [
  {
    id: 1,
    bookingRef: "ATL-1",
    propertyName: "Atlas Stay",
    listingName: "Sea View Studio",
    checkinDate: "2020-01-02",
    checkoutDate: "2020-01-05",
    status: "CheckedOut",
    totalAmount: 5000,
    token: "tok-past-unreviewed",
    reviewed: false,
  },
  {
    id: 2,
    bookingRef: "ATL-2",
    propertyName: "Atlas Stay",
    listingName: "Garden Suite",
    checkinDate: "2020-02-02",
    checkoutDate: "2020-02-05",
    status: "CheckedOut",
    totalAmount: 6000,
    token: "tok-past-reviewed",
    reviewed: true,
  },
  {
    id: 3,
    bookingRef: "ATL-3",
    propertyName: "Atlas Stay",
    listingName: "Hilltop Cabin",
    checkinDate: "2099-01-02",
    checkoutDate: "2099-01-05",
    status: "Confirmed",
    totalAmount: 7000,
    token: "tok-upcoming",
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

describe("MyBookingsPage — TASK-4360 review CTA", () => {
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

  test("no review CTA on the Upcoming tab (checkout not yet passed)", async () => {
    renderPage();
    // Wait for load to finish — the tab list only renders once bookings arrive.
    await screen.findByRole("tab", { name: "Past" });
    // Default tab is Upcoming; the only upcoming booking must not offer a review CTA.
    expect(screen.getByText("Hilltop Cabin")).toBeInTheDocument();
    expect(screen.queryByTestId("my-bookings-review-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("my-bookings-reviewed-badge")).not.toBeInTheDocument();
  });

  test("Past tab shows the CTA for a checked-out unreviewed stay and links to /review/:id", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Past" }));

    const ctas = await screen.findAllByTestId("my-bookings-review-cta");
    // Only the unreviewed past booking (id 1) offers the CTA.
    expect(ctas).toHaveLength(1);
    expect(ctas[0]).toHaveTextContent("Rate your stay");
    expect(ctas[0].getAttribute("href")).toContain("/review/1");
    // Not-yet-checked-out booking (id 3) is filtered out of the Past tab entirely.
    expect(screen.queryByText("Hilltop Cabin")).not.toBeInTheDocument();
  });

  test("Past tab shows a non-CTA Reviewed indicator for an already-reviewed stay", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Past" }));

    await waitFor(() => {
      expect(screen.getByTestId("my-bookings-reviewed-badge")).toBeInTheDocument();
    });
    const badge = screen.getByTestId("my-bookings-reviewed-badge");
    expect(badge).toHaveTextContent("Reviewed");
    // The reviewed state must not be a link/CTA.
    expect(badge.tagName).toBe("SPAN");
    expect(badge.closest("a")).toBeNull();
    // Exactly one CTA total (the unreviewed booking); the reviewed booking has none.
    expect(screen.getAllByTestId("my-bookings-review-cta")).toHaveLength(1);
  });
});
