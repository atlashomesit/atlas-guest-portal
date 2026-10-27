/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import QrMenuPage from "../QrMenuPage";
import { settle } from "@/test/settle";

const MOCK_MENU = {
  tenantName: "Coorg Plantation Resort",
  tenantSlug: "coorg-resort",
  currency: "INR",
  brandColor: "#9e402a",
  roomLabel: "Villa 101",
  listingId: 101,
  tableCode: "T4",
  categories: [
    {
      categoryKey: "FNB",
      title: "F&B (Dining & Room Service)",
      items: [
        {
          id: 1,
          name: "Coorg Pandi Curry",
          description: "Spiced pork curry with local kachampuli",
          price: 480,
          dietary: "NON_VEG",
          outletCategory: "FNB",
          isSoldOut86: false,
        },
        {
          id: 2,
          name: "Akki Roti (2 pcs)",
          description: "Steamed rice rotis with butter and coconut chutney",
          price: 160,
          dietary: "VEG",
          outletCategory: "FNB",
          isSoldOut86: false,
        },
        // 86'd item — MUST BE HIDDEN (Done When #1)
        {
          id: 3,
          name: "Wild Bamboo Shoot Curry",
          description: "Seasonal delicacy (Sold out)",
          price: 380,
          dietary: "VEG",
          outletCategory: "FNB",
          isSoldOut86: true,
        },
      ],
    },
    {
      categoryKey: "EXPERIENCE",
      title: "Experiences & Activities",
      items: [
        {
          id: 4,
          name: "Private Bonfire Night",
          description: "Evening private campfire setup",
          price: 1500,
          dietary: "NA",
          outletCategory: "EXPERIENCE",
          isSoldOut86: false,
        },
      ],
    },
    {
      categoryKey: "TRANSPORT",
      title: "Transport & Pickups",
      items: [
        {
          id: 5,
          name: "Mysore Station Pickup",
          description: "Private cab pickup",
          price: 2600,
          dietary: "NA",
          outletCategory: "TRANSPORT",
          isSoldOut86: false,
        },
      ],
    },
    {
      categoryKey: "RETAIL",
      title: "Retail & Minibar",
      items: [
        {
          id: 6,
          name: "Estate Artisanal Honey",
          description: "Raw unprocessed honey",
          price: 420,
          dietary: "VEG",
          outletCategory: "RETAIL",
          isSoldOut86: false,
        },
      ],
    },
  ],
};

function renderQrMenu(url = "/qr-menu/coorg-resort?room=101") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/qr-menu/:tenantSlug" element={<QrMenuPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  // Mock global fetch
  global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
    if (url.includes("/api/public/qr-menu/coorg-resort?")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => MOCK_MENU,
      });
    }

    if (url.includes("/order") && options?.method === "POST") {
      const body = JSON.parse(options.body);

      // Verify room guardrail: if POST_TO_ROOM and code is "0000" or invalid, return 403 ROOM_VERIFICATION_FAILED
      if (body.settlementMethod === "POST_TO_ROOM" && body.verificationCode !== "4829" && body.verificationCode !== "7391") {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({
            code: "ROOM_VERIFICATION_FAILED",
            error: "Room verification failed: Room does not have an active CheckedIn booking today or phone last-4 / PIN did not match.",
          }),
        });
      }

      // Success
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          orderNumber: "POS-20261021-001",
          status: "KOT_Fired",
          liveStep: "Order Received",
          targetLabel: "Villa 101 (Vikram Sharma)",
          settlementMethod: body.settlementMethod,
          totalAmount: 640,
          gstAmount: 32,
          createdAtUtc: new Date().toISOString(),
          estimatedMinutes: 15,
          kotNumber: "KOT-20261021-105",
          kotStatus: "Pending",
          whatsAppUpdates: body.whatsAppUpdates ?? true,
          lines: body.lines,
        }),
      });
    }

    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  }) as any;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TASK-10298855: Guest Room & Table QR Self-Ordering Web Surface", () => {
  test("renders menu grouped by categories and hides items marked IsSoldOut86 (Done When #1)", async () => {
    renderQrMenu("/qr-menu/coorg-resort?room=101");

    await settle();
    expect(screen.getByTestId("pos-qr-menu-page")).toBeTruthy();

    expect(screen.getByText("Coorg Plantation Resort")).toBeTruthy();
    expect(screen.getByText("Villa 101")).toBeTruthy();

    // Verify category headings
    expect(screen.getByRole("heading", { name: /F&B \(Dining & Room Service\)/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Experiences & Activities/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Transport & Pickups/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Retail & Minibar/i })).toBeTruthy();

    // Available items render
    expect(screen.getByText("Coorg Pandi Curry")).toBeTruthy();
    expect(screen.getByText("Akki Roti (2 pcs)")).toBeTruthy();
    expect(screen.getByText("Private Bonfire Night")).toBeTruthy();

    // Done When #1 Invariant: 86'd item (Wild Bamboo Shoot Curry) must be HIDDEN!
    expect(screen.queryByText("Wild Bamboo Shoot Curry")).toBeNull();
  });

  test("enforces anti-abuse room-charge guardrail: fails with 403 ROOM_VERIFICATION_FAILED when phone/PIN mismatch (Done When #2)", async () => {
    renderQrMenu("/qr-menu/coorg-resort?room=101");

    await settle();
    expect(screen.getByTestId("add-to-cart-1")).toBeTruthy();

    // Add Pandi Curry (480) & Akki Roti (160) = 640
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    fireEvent.click(screen.getByTestId("add-to-cart-2"));

    expect(screen.getByTestId("pos-qr-cart-drawer")).toBeTruthy();
    expect(screen.getByTestId("pos-qr-total").textContent).toContain("640");

    // 'Post to Room' is selected by default for room QR
    expect(screen.getByTestId("pos-qr-room-guardrail-section")).toBeTruthy();

    // Enter wrong verification code "0000"
    const input = screen.getByTestId("pos-qr-verification-input");
    fireEvent.change(input, { target: { value: "0000" } });

    // Submit order
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));

    // Verify 403 ROOM_VERIFICATION_FAILED error message is displayed
    await settle();
    expect(screen.getByTestId("pos-qr-room-verification-error")).toBeTruthy();
    expect(screen.getByText(/Room verification failed: Room does not have an active CheckedIn booking today or phone last-4 \/ PIN did not match/i)).toBeTruthy();
  });

  test("succeeds with valid phone last-4 and renders live status tracker with WhatsApp update badge (Done When #2 & #4)", async () => {
    renderQrMenu("/qr-menu/coorg-resort?room=101");

    await settle();
    expect(screen.getByTestId("add-to-cart-1")).toBeTruthy();

    fireEvent.click(screen.getByTestId("add-to-cart-1"));

    // Enter valid phone last-4 "4829"
    const input = screen.getByTestId("pos-qr-verification-input");
    fireEvent.change(input, { target: { value: "4829" } });

    // Submit order
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));

    // Live status tracker appears (Done When #4)
    await settle();
    expect(screen.getByTestId("pos-qr-live-tracker")).toBeTruthy();
    expect(screen.getByText("POS-20261021-001")).toBeTruthy();
    expect(screen.getByText("Order Received")).toBeTruthy();
    expect(screen.getByText(/Live status updates are active on your WhatsApp/i)).toBeTruthy();
  });

  test("allows Table QR walk-in checkout via Pay Now (UPI) or Pay on Delivery (Done When #3)", async () => {
    renderQrMenu("/qr-menu/coorg-resort?table=T4");

    await settle();
    expect(screen.getByTestId("add-to-cart-1")).toBeTruthy();

    fireEvent.click(screen.getByTestId("add-to-cart-1"));

    // Table QR provides Pay Now (UPI) and Pay on Delivery
    expect(screen.getByTestId("settle-pay-now-upi")).toBeTruthy();
    expect(screen.getByTestId("settle-pay-on-delivery")).toBeTruthy();

    // Select Pay on Delivery
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));

    // Enter guest details
    fireEvent.change(screen.getByTestId("pos-qr-guest-name"), { target: { value: "Aarav Mehta" } });
    fireEvent.change(screen.getByTestId("pos-qr-guest-phone"), { target: { value: "+919811122233" } });

    // Submit order
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));

    await settle();
    expect(screen.getByTestId("pos-qr-live-tracker")).toBeTruthy();
    expect(screen.getByText("POS-20261021-001")).toBeTruthy();
  });
  test("POS-003: Schedule for Later sends scheduledFor and shows the scheduled note; ASAP sends none", async () => {
    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();
    expect(screen.getByTestId("add-to-cart-1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));

    fireEvent.change(screen.getByTestId("pos-qr-fulfill-at"), { target: { value: "DINNER" } });
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes("/order") && options?.method === "POST") {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            orderNumber: "POS-20261024-007", status: "KOT_Fired", liveStep: "Scheduled", targetLabel: "Table T4",
            settlementMethod: body.settlementMethod, totalAmount: 480, gstAmount: 24, createdAtUtc: new Date().toISOString(),
            estimatedMinutes: 15, kotNumber: "KOT-20261024-007", kotStatus: "Scheduled", scheduledFor: body.scheduledFor, lines: body.lines,
          }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));

    await settle();
    expect(screen.getByTestId("pos-qr-scheduled-note")).toBeTruthy();
    const call = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === "POST");
    const body = JSON.parse(call[1].body);
    expect(Number.isNaN(Date.parse(body.scheduledFor))).toBe(false);
    expect(Date.parse(body.scheduledFor)).toBeGreaterThan(Date.now());
  });

  test("POS-003: as soon as possible sends no scheduledFor", async () => {
    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();
    expect(screen.getByTestId("add-to-cart-1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();
    expect(screen.getByTestId("pos-qr-live-tracker")).toBeTruthy();
    const call = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === "POST");
    expect(JSON.parse(call[1].body).scheduledFor).toBeUndefined();
  });
});
