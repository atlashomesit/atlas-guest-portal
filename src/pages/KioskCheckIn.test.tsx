import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import KioskCheckIn from "./KioskCheckIn";
import { settle } from "../test/settle";

const sampleDetails = {
  bookingRef: "ATL-9988",
  listingName: "Monsoon Villa 402",
  guestName: "Aryan Patel",
  checkinDate: "2026-11-25",
  checkoutDate: "2026-11-28",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  doorCode: "782190",
  wifiName: "MonsoonGuest",
  wifiPassword: "safePassword123",
  houseRulesText: "Quiet hours 10 PM to 7 AM.",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderKioskAt(path = "/kiosk") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/kiosk/:bookingRef" element={<KioskCheckIn />} />
        <Route path="/kiosk" element={<KioskCheckIn />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("KioskCheckIn Component", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(global.navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      writable: true,
      configurable: true,
    });
    // Mock URL.createObjectURL on the existing URL constructor
    if (typeof URL.createObjectURL === "undefined") {
      URL.createObjectURL = vi.fn(() => "blob:mock-kiosk-id-image");
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-kiosk-id-image");
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("renders welcome screen on /kiosk and transitions to lookup on touch", async () => {
    renderKioskAt("/kiosk");

    expect(screen.getByTestId("kiosk-welcome-screen")).toBeInTheDocument();
    expect(screen.getByText("Express Self Check-In Kiosk")).toBeInTheDocument();

    const beginBtn = screen.getByTestId("kiosk-begin-btn");
    fireEvent.click(beginBtn);

    expect(screen.getByTestId("kiosk-lookup-screen")).toBeInTheDocument();
    expect(screen.getByTestId("kiosk-ref-input")).toBeInTheDocument();
  });

  test("pre-fills booking reference when opened at /kiosk/:bookingRef", async () => {
    renderKioskAt("/kiosk/ATL-9988");

    expect(screen.getByTestId("kiosk-lookup-screen")).toBeInTheDocument();
    const input = screen.getByTestId("kiosk-ref-input") as HTMLInputElement;
    expect(input.value).toBe("ATL-9988");
  });

  test("lookup displays error on 404 booking not found", async () => {
    (global.fetch as Mock).mockResolvedValueOnce(jsonResponse({ error: "NotFound" }, 404));

    renderKioskAt("/kiosk");
    fireEvent.click(screen.getByTestId("kiosk-begin-btn"));

    const input = screen.getByTestId("kiosk-ref-input");
    fireEvent.change(input, { target: { value: "INVALID-REF" } });

    fireEvent.click(screen.getByTestId("kiosk-lookup-submit"));
    await settle();

    expect(screen.getByText(/Booking not found/i)).toBeInTheDocument();
  });

  test("full check-in flow: lookup -> camera ID scan -> house rules signature -> access pass", async () => {
    // 1. Mock lookup response
    (global.fetch as Mock)
      .mockResolvedValueOnce(jsonResponse(sampleDetails, 200)) // lookup
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200)) // id upload
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200)) // rules accept
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200)); // complete

    // Mock HTMLCanvasElement getContext and toBlob for both capture and signature
    const mockCtx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx) as any;
    HTMLCanvasElement.prototype.toBlob = function (callback: (blob: Blob | null) => void) {
      callback(new Blob(["mock-image-bytes"], { type: "image/jpeg" }));
    };
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();

    renderKioskAt("/kiosk/ATL-9988");

    // Submit lookup
    fireEvent.click(screen.getByTestId("kiosk-lookup-submit"));
    await settle();

    // Now in ID scan step
    expect(screen.getByTestId("kiosk-id-scan-screen")).toBeInTheDocument();
    expect(screen.getByText(/Verify Government ID/i)).toBeInTheDocument();

    const captureBtn = screen.getByTestId("kiosk-capture-btn");
    expect(captureBtn).toBeInTheDocument();

    fireEvent.click(captureBtn);
    await settle();

    const confirmIdBtn = screen.getByTestId("kiosk-id-confirm-btn");
    expect(confirmIdBtn).toBeInTheDocument();
    fireEvent.click(confirmIdBtn);

    // Now in House Rules step
    expect(screen.getByTestId("kiosk-rules-screen")).toBeInTheDocument();
    expect(screen.getByText(/House Rules & Terms/i)).toBeInTheDocument();

    // Simulate drawing on canvas signature pad
    const canvas = screen.getByTestId("kiosk-signature-pad");

    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(canvas);

    // Confirm rules and finalize
    const confirmRulesBtn = screen.getByTestId("kiosk-rules-confirm-btn");
    expect(confirmRulesBtn).not.toBeDisabled();
    fireEvent.click(confirmRulesBtn);
    await settle();

    // Now in Pass screen
    expect(screen.getByTestId("kiosk-pass-screen")).toBeInTheDocument();
    expect(screen.getByText("You Are Checked In!")).toBeInTheDocument();
    expect(screen.getByText("Monsoon Villa 402")).toBeInTheDocument();
    expect(screen.getByText("782190")).toBeInTheDocument();
    expect(screen.getByText(/MonsoonGuest/i)).toBeInTheDocument();

    // Return to welcome
    fireEvent.click(screen.getByTestId("kiosk-done-btn"));
    expect(screen.getByTestId("kiosk-welcome-screen")).toBeInTheDocument();
  });
});
