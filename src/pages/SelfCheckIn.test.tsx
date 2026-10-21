/**
 * GUEST-030: a /check-in/{ref}?t={token} link opens straight into the stay summary on the token
 * alone (no last-name form). An invalid or expired token falls back to the last-name form with a
 * gentle notice, and links without a token behave exactly as before.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi, type Mock } from "vitest";
import SelfCheckIn from "./SelfCheckIn";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

const details = {
  bookingRef: "ATL-4242",
  listingName: "Lake View Loft",
  propertyAddress: "Udaipur",
  checkinDate: "2026-11-02",
  checkoutDate: "2026-11-04",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  checkinInstructions: "",
  wifiName: "",
  wifiPassword: "",
  houseRulesText: "Quiet hours.",
  emergencyContactPhone: "",
  doorCode: "",
  idUploadRequired: false,
  houseRulesSignedAt: "2026-10-20T10:00:00Z",
  guestCount: 1,
  guestName: "Priya Sharma",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/check-in/:bookingRef" element={<SelfCheckIn />} />
        <Route path="/check-in" element={<SelfCheckIn />} />
      </Routes>
    </MemoryRouter>,
  );
}

const fetchMock = () => global.fetch as Mock;
const calledUrl = (i: number) => String(fetchMock().mock.calls[i][0]);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SelfCheckIn token auto-verify (GUEST-030)", () => {
  test("a valid token link skips the last-name form and lands on the summary", async () => {
    fetchMock().mockResolvedValueOnce(json(details));

    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const url = calledUrl(0);
    expect(url).toContain("/api/public/checkin/ATL-4242?t=tok-123");
    expect(url).not.toContain("lastName=");
    expect(screen.getByRole("heading", { name: "Lake View Loft" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Last name")).not.toBeInTheDocument();
    expect(screen.queryByTestId("checkin-token-fallback-notice")).not.toBeInTheDocument();
  });

  test("later steps still send the last name, taken from the verified guest name", async () => {
    fetchMock()
      .mockResolvedValueOnce(json(details))
      .mockResolvedValueOnce(json({ required: true, signed: false, waiverPdfUrl: null }));

    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await settle();
    fireEvent.click(screen.getByTestId("checkin-house-rules-continue"));
    await settle();

    const waiverUrl = calledUrl(1);
    expect(waiverUrl).toContain("/api/public/checkin/ATL-4242/damage-waiver?lastName=Sharma&t=tok-123");
  });

  test("an invalid or expired token falls back to the last-name form with a notice", async () => {
    fetchMock()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(json(details));

    renderAt("/check-in/ATL-4242?t=expired");
    await settle();

    expect(screen.getByTestId("checkin-token-fallback-notice")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Booking reference")).toHaveValue("ATL-4242");

    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Sharma" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await settle();

    expect(calledUrl(1)).toContain("/api/public/checkin/ATL-4242?lastName=Sharma&t=expired");
    expect(screen.getByRole("heading", { name: "Lake View Loft" })).toBeInTheDocument();
  });

  test("a link without a token shows the last-name form and makes no request", async () => {
    renderAt("/check-in/ATL-4242");
    await settle();

    expect(fetchMock()).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(screen.queryByTestId("checkin-token-fallback-notice")).not.toBeInTheDocument();
  });
});
