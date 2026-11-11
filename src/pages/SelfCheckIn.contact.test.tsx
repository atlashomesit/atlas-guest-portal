/**
 * NOTIF-048: the details step asks for a WhatsApp number (required when we have no deliverable one) and an
 * optional email; both travel in the complete request only when typed, and the server's INVALID_GUEST_*
 * answers are shown in plain words next to the field. No marketing-consent control exists on the page.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi, type Mock } from "vitest";
import SelfCheckIn from "./SelfCheckIn";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

const baseDetails = {
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
  guestHasDeliverablePhone: false,
  guestHasUsableEmail: false,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/check-in/:bookingRef" element={<SelfCheckIn />} />
      </Routes>
    </MemoryRouter>,
  );
}

const fetchMock = () => global.fetch as Mock;

/** Summary -> Continue -> ID step Skip -> house rules Continue -> (waiver already signed) -> complete. */
async function runFromSummaryToComplete() {
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await settle();
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  await settle();
  fireEvent.click(screen.getByTestId("checkin-house-rules-continue"));
  await settle();
}

function completeCall(): { url: string; body: Record<string, unknown> } | undefined {
  const call = fetchMock().mock.calls.find(([u]) => String(u).includes("/complete"));
  if (!call) return undefined;
  return { url: String(call[0]), body: JSON.parse(String((call[1] as RequestInit).body)) };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SelfCheckIn contact capture (NOTIF-048)", () => {
  test("blocks Continue with a message when there is no deliverable phone and none is typed", async () => {
    fetchMock().mockResolvedValueOnce(json(baseDetails));
    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent(/enter your whatsapp mobile number/i);
    expect(screen.getByLabelText(/whatsapp mobile number/i)).toBeRequired();
    // Still on the details step: the ID step never opened.
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  });

  test("the phone is optional when we already have a deliverable one, and nothing is sent when nothing is typed", async () => {
    fetchMock()
      .mockResolvedValueOnce(json({ ...baseDetails, guestHasDeliverablePhone: true, guestHasUsableEmail: true }))
      .mockResolvedValueOnce(json({ required: false, signed: true, waiverPdfUrl: null }))
      .mockResolvedValueOnce(json({}));
    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    expect(screen.getByLabelText(/whatsapp mobile number/i)).not.toBeRequired();
    await runFromSummaryToComplete();

    const call = completeCall();
    expect(call).toBeDefined();
    expect(call!.body).not.toHaveProperty("guestPhone");
    expect(call!.body).not.toHaveProperty("guestEmail");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("a mistyped number is caught on the details step without calling the server", async () => {
    fetchMock().mockResolvedValueOnce(json(baseDetails));
    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    fireEvent.change(screen.getByLabelText(/whatsapp mobile number/i), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent(/valid whatsapp mobile number/i);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  test("typed phone and email are sent in the complete request body", async () => {
    fetchMock()
      .mockResolvedValueOnce(json(baseDetails))
      .mockResolvedValueOnce(json({ required: false, signed: true, waiverPdfUrl: null }))
      .mockResolvedValueOnce(json({}));
    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    fireEvent.change(screen.getByLabelText(/whatsapp mobile number/i), { target: { value: " 98765 43210 " } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "priya@example.com" } });
    await runFromSummaryToComplete();

    const call = completeCall();
    expect(call).toBeDefined();
    expect(call!.url).toContain("/api/public/checkin/ATL-4242/complete");
    expect(call!.body.guestPhone).toBe("98765 43210");
    expect(call!.body.guestEmail).toBe("priya@example.com");
    expect(screen.getByText(/you're checked in/i)).toBeInTheDocument();
  });

  test("a 400 INVALID_GUEST_PHONE from the server is shown in words next to the field", async () => {
    fetchMock()
      .mockResolvedValueOnce(json(baseDetails))
      .mockResolvedValueOnce(json({ required: false, signed: true, waiverPdfUrl: null }))
      .mockResolvedValueOnce(json({ error: "INVALID_GUEST_PHONE", message: "bad" }, 400));
    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    fireEvent.change(screen.getByLabelText(/whatsapp mobile number/i), { target: { value: "9000000000" } });
    await runFromSummaryToComplete();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/whatsapp number doesn't look right/i);
    expect(alert.textContent).not.toMatch(/INVALID_GUEST_PHONE/);
    expect(screen.getByLabelText(/whatsapp mobile number/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/Could not save your check-in/)).not.toBeInTheDocument();
  });

  test("a 400 INVALID_GUEST_EMAIL from the server is shown in words next to the email field", async () => {
    fetchMock()
      .mockResolvedValueOnce(json({ ...baseDetails, guestHasDeliverablePhone: true }))
      .mockResolvedValueOnce(json({ required: false, signed: true, waiverPdfUrl: null }))
      .mockResolvedValueOnce(json({ error: "INVALID_GUEST_EMAIL", message: "bad" }, 400));
    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "relay@guest.booking.com" } });
    await runFromSummaryToComplete();

    expect(screen.getByRole("alert")).toHaveTextContent(/enter your own email/i);
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute("aria-invalid", "true");
  });

  test("no consent checkbox is rendered, and the values are not written to localStorage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    fetchMock().mockResolvedValueOnce(json(baseDetails));
    renderAt("/check-in/ATL-4242?t=tok-123");
    await settle();

    fireEvent.change(screen.getByLabelText(/whatsapp mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "priya@example.com" } });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/marketing|promotional|offers and updates/i);
    const stored = setItem.mock.calls.map((c) => String(c[1])).join("|");
    expect(stored).not.toContain("9876543210");
    expect(stored).not.toContain("priya@example.com");
  });
});
