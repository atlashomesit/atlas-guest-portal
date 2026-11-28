import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { settle } from "@/test/settle";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TripSummarySharePage } from "./TripSummarySharePage";
import { TripSummaryShareCard } from "../components/booking/TripSummaryShareCard";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("TripSummarySharePage & TripSummaryShareCard (GUEST-098)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders privacy-safe shared trip summary with maps and call host buttons", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        tenantBrand: "Atlas Villa Stays",
        propertyName: "Hilltop Pool Villa",
        propertyAddress: "123 Sunset Ridge, Lonavala",
        googleMapsUrl: "https://maps.google.com/?q=123+Sunset+Ridge",
        checkInDate: "12 Dec 2026",
        checkOutDate: "14 Dec 2026",
        checkInTime: "2:00 PM",
        checkOutTime: "11:00 AM",
        hostPhone: "+91 98765 43210",
      },
    });

    render(
      <MemoryRouter initialEntries={["/trip-summary/safe-token-123"]}>
        <Routes>
          <Route path="/trip-summary/:shareToken" element={<TripSummarySharePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByTestId("trip-summary-page")).toBeInTheDocument();

    expect(screen.getByText("Shared trip summary")).toBeInTheDocument();
    expect(screen.getByText("Hilltop Pool Villa")).toBeInTheDocument();
    expect(screen.getByTestId("trip-summary-address")).toHaveTextContent("123 Sunset Ridge, Lonavala");
    expect(screen.getByTestId("trip-summary-maps-btn")).toHaveAttribute(
      "href",
      "https://maps.google.com/?q=123+Sunset+Ridge",
    );
    expect(screen.getByTestId("trip-summary-call-btn")).toHaveAttribute("href", "tel:+919876543210");
  });

  it("shows unavailable state when share token is disabled / 404", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("404"));

    render(
      <MemoryRouter initialEntries={["/trip-summary/revoked-token"]}>
        <Routes>
          <Route path="/trip-summary/:shareToken" element={<TripSummarySharePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByTestId("trip-summary-not-found")).toBeInTheDocument();
  });

  it("generates and disables a privacy-safe trip summary link from TripSummaryShareCard", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { shareToken: "opaque-xyz" } });
    vi.mocked(api.delete).mockResolvedValueOnce({ data: { ok: true } });

    render(
      <TripSummaryShareCard bookingId={55} token="bk-tok" propertyName="Hilltop Pool Villa" />,
    );

    fireEvent.click(screen.getByTestId("trip-summary-generate-btn"));

    await settle();
    expect(screen.getByTestId("trip-summary-share-url")).toHaveTextContent("/trip-summary/opaque-xyz");

    expect(api.post).toHaveBeenCalledWith(
      "/public/bookings/55/trip-summary-link",
      {},
      { params: { t: "bk-tok" } },
    );

    fireEvent.click(screen.getByTestId("trip-summary-disable-btn"));

    await settle();
    expect(screen.getByTestId("trip-summary-generate-btn")).toBeInTheDocument();

    expect(api.delete).toHaveBeenCalledWith("/public/bookings/55/trip-summary-link", {
      params: { t: "bk-tok" },
    });
  });
});
