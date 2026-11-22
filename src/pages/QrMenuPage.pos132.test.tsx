import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import QrMenuPage from "./QrMenuPage";
import { settle } from "../test/settle";

vi.mock("../components/SEO", () => ({ default: () => null }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const sampleMenu = {
  tenantName: "Hill Cafe",
  tenantSlug: "hillcafe",
  currency: "INR",
  tableCode: "T4",
  roomLinkStatus: "NONE",
  categories: [
    {
      categoryKey: "FNB",
      title: "F&B (Dining & Room Service)",
      items: [
        { id: 10, name: "Veg Maggi", price: 80, dietary: "VEG", outletCategory: "FNB", isSoldOut86: false },
        { id: 11, name: "Masala Chai", price: 40, dietary: "VEG", outletCategory: "FNB", isSoldOut86: false },
        { id: 12, name: "Chicken Wings", price: 220, dietary: "NON_VEG", outletCategory: "FNB", isSoldOut86: false },
        { id: 13, name: "Bonfire Pass", price: 500, dietary: "VEG", outletCategory: "EXPERIENCE", isSoldOut86: false },
      ],
    },
  ],
  suggestions: [
    {
      id: 901,
      kind: "OrderStart",
      offeredAddOnServiceId: 13,
      offeredItemName: "Bonfire Pass",
      offeredItemPrice: 500,
      offeredDietary: "VEG",
      guestText: "Tonight's bonfire at 8 PM",
      triggerAddOnServiceIds: [],
      triggerCategories: [],
    },
    {
      id: 902,
      kind: "Pairing",
      offeredAddOnServiceId: 11,
      offeredItemName: "Masala Chai",
      offeredItemPrice: 40,
      offeredDietary: "VEG",
      guestText: "Goes well with your Veg Maggi",
      triggerAddOnServiceIds: [10],
      triggerCategories: [],
    },
    {
      id: 903,
      kind: "Pairing",
      offeredAddOnServiceId: 12,
      offeredItemName: "Chicken Wings",
      offeredItemPrice: 220,
      offeredDietary: "NON_VEG",
      guestText: "Add Chicken Wings",
      triggerAddOnServiceIds: [10],
      triggerCategories: [],
    },
  ],
};

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/menu/hillcafe?table=T4"]}>
      <Routes>
        <Route path="/menu/:tenantSlug" element={<QrMenuPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("POS-132 upsell suggestions on QrMenuPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows OrderStart banner when cart empty, inline Pairing on trigger tap, dietary filter exclusion, and submits suggestionId + suggestionsShown", async () => {
    let capturedOrderBody: any = null;
    vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/order")) {
        capturedOrderBody = JSON.parse(String(init?.body ?? "{}"));
        return jsonResponse({
          orderNumber: "POS-20300610-001",
          status: "KOT_Fired",
          liveStep: "Order Received",
          targetLabel: "Table T4",
          settlementMethod: "PAY_NOW_UPI",
          totalAmount: 120,
          gstAmount: 6,
          createdAtUtc: "2030-06-10T10:00:00Z",
          estimatedMinutes: 15,
          lines: [],
        }, 201);
      }
      return jsonResponse(sampleMenu);
    });

    renderMenu();
    await settle();
    await settle();

    // OrderStart banner visible while cart empty
    expect(screen.getByTestId("qr-suggestion-order-start").textContent).toContain("Tonight's bonfire at 8 PM");

    // Tap Pure Veg filter -> Chicken Wings offer stays excluded when Veg Maggi is tapped
    fireEvent.click(screen.getByTestId("qr-dietary-chip-PURE_VEG"));

    // Add Veg Maggi (item 10)
    const maggiCard = screen.getByTestId("menu-item-10");
    const addMaggiBtn = maggiCard.querySelector("button")!;
    fireEvent.click(addMaggiBtn);
    await settle();

    // OrderStart hides once cart > 0; inline Pairing shows Masala Chai (902), never Chicken Wings (903)
    expect(screen.queryByTestId("qr-suggestion-order-start")).toBeNull();
    const inlineCard = screen.getByTestId("qr-suggestion-inline");
    expect(inlineCard.textContent).toContain("Masala Chai");
    expect(inlineCard.textContent).not.toContain("Chicken Wings");

    // Accept Masala Chai via inline "+ Add"
    fireEvent.click(screen.getByTestId("qr-suggestion-add-902"));
    await settle();

    // Cart now contains Veg Maggi (no suggestionId) and Masala Chai (suggestionId: 902)
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    expect(capturedOrderBody).not.toBeNull();
    expect(capturedOrderBody.suggestionsShown).toContain(901);
    expect(capturedOrderBody.suggestionsShown).toContain(902);
    const chaiLine = capturedOrderBody.lines.find((l: any) => l.addOnServiceId === 11);
    expect(chaiLine?.suggestionId).toBe(902);
    const maggiLine = capturedOrderBody.lines.find((l: any) => l.addOnServiceId === 10);
    expect(maggiLine?.suggestionId).toBeUndefined();
  });
});
