import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import MyBookingsPage from "./MyBookingsPage";
import { GuestAuthContext, type GuestAuthState } from "../contexts/GuestAuthContext";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const sampleBookings = [
  {
    id: 421,
    bookingRef: "ATL-421",
    propertyName: "Atlas Stay Indiranagar",
    listingName: "Penthouse Suite",
    checkinDate: "2099-03-10",
    checkoutDate: "2099-03-14",
    status: "Confirmed",
    totalAmount: 12000,
    token: "booking-tok-421",
    listingId: 88,
  },
];

const signedInAuth: GuestAuthState = {
  isAuthenticated: true,
  token: "jwt-session-token",
  email: "guest@example.com",
  guestId: 3001,
};

describe("MyBookingsPage — GUEST-056 Update contact details link", () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/guest/bookings") || url.includes("/api/guest/auth/bookings")) {
        return jsonResponse(sampleBookings);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders Update contact details link for OTP-authenticated guest without URL query params", async () => {
    render(
      <MemoryRouter initialEntries={["/my-bookings"]}>
        <GuestAuthContext.Provider value={{ auth: signedInAuth, isLoading: false, login: vi.fn(), logout: vi.fn() }}>
          <Routes>
            <Route path="/my-bookings" element={<MyBookingsPage />} />
          </Routes>
        </GuestAuthContext.Provider>
      </MemoryRouter>,
    );
    await settle();

    const updateLink = screen.getByTestId("my-bookings-update-profile") as HTMLAnchorElement;
    expect(updateLink).toBeInTheDocument();
    expect(updateLink).toHaveTextContent(/Update contact details/i);
    expect(updateLink.getAttribute("href")).toBe("/profile?bookingId=421&t=booking-tok-421");
  });

  test("renders Update contact details link for magic-link guest using bookings[0].token", async () => {
    const signedOutAuth: GuestAuthState = {
      isAuthenticated: false,
      token: null,
      email: null,
      guestId: null,
    };

    render(
      <MemoryRouter initialEntries={["/bookings?guestId=3001&t=magic-url-token"]}>
        <GuestAuthContext.Provider value={{ auth: signedOutAuth, isLoading: false, login: vi.fn(), logout: vi.fn() }}>
          <Routes>
            <Route path="/bookings" element={<MyBookingsPage />} />
          </Routes>
        </GuestAuthContext.Provider>
      </MemoryRouter>,
    );
    await settle();

    const updateLink = screen.getByTestId("my-bookings-update-profile") as HTMLAnchorElement;
    expect(updateLink).toBeInTheDocument();
    expect(updateLink.getAttribute("href")).toBe("/profile?bookingId=421&t=booking-tok-421");
  });
});
