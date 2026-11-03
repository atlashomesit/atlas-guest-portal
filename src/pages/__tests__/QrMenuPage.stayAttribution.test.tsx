/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QrMenuPage from "../QrMenuPage";
import { settle } from "@/test/settle";

const response = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, headers: new Headers() });
const menu = {
  tenantName: "Owner UX", tenantSlug: "owner-ux", currency: "INR", listingId: 31,
  roomLabel: "Courtyard Room A", roomLinkStatus: "KEY", roomChargeLocked: false,
  categories: [{ categoryKey: "FNB", title: "Dining", items: [{ id: 1, name: "Coffee", price: 105, outletCategory: "FNB" }] }],
};
const order = {
  orderNumber: "POS-1", status: "PostedToRoom", liveStep: "Order Received", targetLabel: "Heritage Whole Villa",
  chargedStayLabel: "Heritage Whole Villa", orderedFromLabel: "Courtyard Room A", bedLabel: "Courtyard Room A",
  settlementMethod: "POST_TO_ROOM", totalAmount: 105, gstAmount: 5, createdAtUtc: "2026-11-03T12:00:00Z", estimatedMinutes: 15, lines: [],
};
function setup(handler: (body: Record<string, unknown>) => ReturnType<typeof response>, suffix = "") {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      bodies.push(body);
      return handler(body);
    }
    return response(200, url.includes("/order/") ? order : menu);
  }));
  render(<MemoryRouter initialEntries={[`/qr-menu/owner-ux?rk=test-room-key${suffix}`]}>
    <Routes><Route path="/qr-menu/:tenantSlug" element={<QrMenuPage />} /></Routes>
  </MemoryRouter>);
  return bodies;
}
async function submit() {
  await settle();
  fireEvent.click(screen.getByTestId("add-to-cart-1"));
  fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "4821" } });
  fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
  await settle();
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("QR verified stay attribution", () => {
  test("shows charged parent and ordered-from suite after posting", async () => {
    setup(() => response(201, order));
    await submit();
    const attribution = screen.getByTestId("pos-qr-charge-attribution");
    expect(attribution).toHaveTextContent("Charged to Heritage Whole Villa");
    expect(attribution).toHaveTextContent("Ordered from Courtyard Room A");
  });
  test("restores the same attribution from a saved order URL", async () => {
    setup(() => response(201, order), "&order=POS-1");
    await settle();
    expect(screen.getByTestId("pos-qr-charge-attribution")).toHaveTextContent("Ordered from Courtyard Room A");
  });
  test("verified multi-bed refusal asks for a bed and retries with the canonical label", async () => {
    const beds = ["Dorm A · Bed B1", "Dorm A · Bed B2"];
    const bodies = setup(body => body.bedLabel ? response(201, {
      ...order, chargedStayLabel: "Dorm A", orderedFromLabel: null, bedLabel: body.bedLabel,
    }) : response(400, { code: "BED_SELECTION_REQUIRED", error: "Choose the bed to charge.", bedOptions: beds, chargedStayLabel: "Dorm A" }));
    await submit();
    expect(screen.queryByTestId("pos-qr-live-tracker")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Bed to charge"), { target: { value: beds[1] } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();
    expect(bodies).toHaveLength(2);
    expect(bodies[0].bedLabel).toBeUndefined();
    expect(bodies[1].bedLabel).toBe(beds[1]);
    expect(bodies[1].verificationCode).toBe("4821");
    expect(screen.getByTestId("pos-qr-charge-attribution")).toHaveTextContent(beds[1]);
  });
  test("changing verification clears the previous stay's bed choices", async () => {
    setup(() => response(400, { code: "BED_SELECTION_REQUIRED", error: "Choose the bed to charge.", bedOptions: ["Dorm A · Bed B1", "Dorm A · Bed B2"], chargedStayLabel: "Dorm A" }));
    await submit();
    expect(screen.getByLabelText("Bed to charge")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "2222" } });
    expect(screen.queryByLabelText("Bed to charge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pos-qr-verified-stay")).not.toBeInTheDocument();
  });
  test("invalid verification does not offer bed choices or show a charged stay", async () => {
    setup(() => response(403, { code: "ROOM_VERIFICATION_FAILED", error: "Please check your PIN.", attemptsRemaining: 4 }));
    await submit();
    expect(screen.queryByLabelText("Bed to charge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pos-qr-charge-attribution")).not.toBeInTheDocument();
    expect(screen.getByText(/Please check your PIN/)).toBeInTheDocument();
  });
});
