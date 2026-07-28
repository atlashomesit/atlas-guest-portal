import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import MyBookingsPage from "./MyBookingsPage";
import { GuestAuthProvider } from "../contexts/GuestAuthContext";

// TASK-6061: `filteredBookings` bucketed a booking into "Upcoming"/"Past" by comparing
// `parseBookingDate(b.checkoutDate)` (previously UTC-midnight, per `new Date("YYYY-MM-DD")`)
// against `startOfTodayUtc()` (actually LOCAL midnight despite its old name) — two different
// zones being compared against each other. For a guest west of UTC, a stay checking out "today"
// could parse to yesterday-in-UTC-terms and fall on the wrong side of that boundary. Fixed by
// routing both through the same local-midnight construction (`utils/formatting.ts#parseDate`).
// This is written to FAIL under `America/Los_Angeles` against the pre-fix code.

vi.mock("../components/SEO", () => ({ default: () => null }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function localIsoToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function renderMagicLink() {
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

describe("MyBookingsPage — TASK-6061 tab bucketing is time-zone invariant", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
    cleanup();
    vi.restoreAllMocks();
  });

  test("a stay checking out 'today' (local) lands on Upcoming, not Past, under a western TZ", async () => {
    process.env.TZ = "America/Los_Angeles";
    const todayLocal = localIsoToday();

    const inProgressToday = {
      id: 99,
      bookingRef: "ATL-TODAY",
      propertyName: "Atlas Stay",
      listingName: "Checkout Today Suite",
      checkinDate: todayLocal,
      checkoutDate: todayLocal,
      status: "CheckedIn",
      totalAmount: 4000,
      token: "tok-today",
    };

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings")) return jsonResponse([inProgressToday]);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderMagicLink();

    // Default tab is Upcoming — a same-day checkout must still classify as upcoming/in-progress,
    // never silently reclassified into Past a day early.
    expect(await screen.findByText("Checkout Today Suite")).toBeInTheDocument();
    expect(screen.getByTestId("my-bookings-in-stay-badge")).toBeInTheDocument();
  });

  test("a stay that checked out yesterday (local) lands on Past, not Upcoming, under a western TZ", async () => {
    process.env.TZ = "America/Los_Angeles";
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const yesterdayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const checkedOutYesterday = {
      id: 98,
      bookingRef: "ATL-YDAY",
      propertyName: "Atlas Stay",
      listingName: "Checked Out Yesterday Suite",
      checkinDate: yesterdayLocal,
      checkoutDate: yesterdayLocal,
      status: "CheckedOut",
      totalAmount: 4000,
      token: "tok-yesterday",
    };

    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings")) return jsonResponse([checkedOutYesterday]);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderMagicLink();

    // Upcoming tab (default) must NOT show it...
    await screen.findByTestId("my-bookings-filter-empty");
    expect(screen.queryByText("Checked Out Yesterday Suite")).not.toBeInTheDocument();

    // ...but the Past tab must.
    fireEvent.click(screen.getByRole("tab", { name: "Past" }));
    expect(await screen.findByText("Checked Out Yesterday Suite")).toBeInTheDocument();
  });
});
