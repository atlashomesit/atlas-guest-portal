import { cleanup, render, screen, within } from "@testing-library/react";
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

const summaryBody = {
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
  propertyAddress: "12 Lake View Road, Hyderabad",
  propertyPhone: "+919999999999",
  checkinInstructions: "Front desk",
  currency: "INR",
  totalAmount: 5000,
  wifiVisible: false,
  checkInTime: "14:00",
  checkOutTime: "11:00",
  mealPlanCode: "EP",
  cancellationPolicy: "Moderate",
};

function mockFetch(overrides: Partial<typeof summaryBody> = {}) {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/guest/bookings/101/summary")) return jsonResponse({ ...summaryBody, ...overrides });
    if (url.includes("/api/public/bookings/101/modification-requests")) return jsonResponse([]);
    if (url.includes("/listings/777/add-ons")) return jsonResponse([]);
    if (url.includes("/bookings/101/payment-status")) return jsonResponse({ status: "Paid" });
    return jsonResponse({});
  });
}

describe("BookingConfirmationPage GUEST-031 Stay & Arrival Hub", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("one hub carries every arrival action, with no duplicate cards", async () => {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    mockFetch();
    render(
      <MemoryRouter initialEntries={["/booking/101?t=tok-abc"]}>
        <Routes>
          <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await settle();

    const hubs = screen.getAllByTestId("stay-arrival-hub");
    expect(hubs).toHaveLength(1);
    const hub = within(hubs[0]);

    // (c) check-in CTA keeps the GUEST-030 token deep-link
    const checkin = hub.getByTestId("stay-hub-checkin") as HTMLAnchorElement;
    expect(checkin.getAttribute("href")).toBe("/check-in/ATL-101?t=tok-abc");
    // (a) WhatsApp with pre-filled booking id + guest name
    const wa = decodeURIComponent((hub.getByTestId("stay-hub-whatsapp") as HTMLAnchorElement).href);
    expect(wa).toContain("#101");
    expect(wa).toContain("Test Guest");
    // (b) combined calendar actions
    expect(hub.getByTestId("confirmation-add-google-calendar")).toBeInTheDocument();
    expect(hub.getByTestId("confirmation-download-ics")).toBeInTheDocument();
    // (d) print / save guide
    expect(hub.getByTestId("download-stay-guide-btn")).toBeInTheDocument();

    // retired duplicates are gone; each action exists exactly once on the page
    for (const id of ["self-checkin-done", "self-checkin-link", "trip-preparation-card", "confirmation-calendar-section", "trip-prep-add-calendar", "trip-prep-message-host-whatsapp"]) {
      expect(screen.queryAllByTestId(id)).toHaveLength(0);
    }
    for (const id of ["confirmation-add-google-calendar", "confirmation-download-ics", "download-stay-guide-btn", "stay-hub-checkin"]) {
      expect(screen.getAllByTestId(id)).toHaveLength(1);
    }

    // GUEST-029 plan terms untouched
    expect(screen.getByTestId("confirmation-plan-terms")).toBeInTheDocument();
  });
});

// UXD-2026-10-27-06-A: only Pending changes draft wording, never action eligibility.
describe("BookingConfirmationPage Pending host message", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); window.sessionStorage.clear(); });

  async function renderBooking(overrides: Partial<typeof summaryBody> = {}) {
    window.sessionStorage.setItem("booking_101_payment_status", "success");
    mockFetch(overrides);
    render(<MemoryRouter initialEntries={["/booking/101?t=tok-abc"]}><Routes><Route path="/booking/:bookingId" element={<BookingConfirmationPage />} /></Routes></MemoryRouter>);
    await settle();
  }

  test("Pending draft uses current booking identity/status, host number and all hub actions", async () => {
    await renderBooking({ status: "Pending", guestName: "Different Guest", propertyName: "Coastal Cottage" });
    const link = screen.getByTestId("stay-hub-whatsapp") as HTMLAnchorElement;
    const url = new URL(link.href);
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/919999999999");
    expect(url.searchParams.get("text")).toBe("Hi, I have a question about booking #101 under Different Guest at Coastal Cottage. Its current status is Pending. Please help me check the booking status.");
    expect(screen.getByTestId("stay-hub-whatsapp-status")).toHaveTextContent("Your message includes booking #101 and its Pending status.");
    const hub = within(screen.getByTestId("stay-arrival-hub"));
    expect(hub.getByTestId("stay-hub-checkin")).toHaveAttribute("href", "/check-in/ATL-101?t=tok-abc");
    for (const id of ["confirmation-add-google-calendar", "confirmation-download-ics", "download-stay-guide-btn"]) {
      expect(hub.getByTestId(id)).toBeInTheDocument();
    }
  });

  test("Pending without guest name does not invent an identity", async () => {
    await renderBooking({ status: "Pending", guestName: "" });
    const url = new URL((screen.getByTestId("stay-hub-whatsapp") as HTMLAnchorElement).href);
    expect(url.searchParams.get("text")).toBe("Hi, I have a question about booking #101 at Atlas Stay. Its current status is Pending. Please help me check the booking status.");
  });

  test.each(["Confirmed", "CheckedIn", "CheckedOut", "Expired"])("%s retains the existing wording and hub eligibility", async (status) => {
    await renderBooking({ status });
    const url = new URL((screen.getByTestId("stay-hub-whatsapp") as HTMLAnchorElement).href);
    expect(url.searchParams.get("text")).toBe("Hi, I have a confirmed booking (#101) under Test Guest at Atlas Stay. Looking forward to my stay!");
    expect(screen.queryByTestId("stay-hub-whatsapp-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("stay-arrival-hub")).toBeInTheDocument();
  });

  test("Cancelled still has no arrival hub", async () => {
    await renderBooking({ status: "Cancelled" });
    expect(screen.queryByTestId("stay-arrival-hub")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stay-hub-whatsapp")).not.toBeInTheDocument();
  });

  test("Pending without a configured host number exposes no WhatsApp action or draft helper", async () => {
    await renderBooking({ status: "Pending", propertyPhone: "" });
    expect(screen.queryByTestId("stay-hub-whatsapp")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stay-hub-whatsapp-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("confirmation-download-ics")).toBeInTheDocument();
  });
});
