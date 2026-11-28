import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import QrMenuPage from "../QrMenuPage";
import { settle } from "../../test/settle";

vi.mock("../../components/SEO", () => ({ default: () => null }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderMenu(menuPayload: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse(menuPayload)),
  );
  return render(
    <MemoryRouter initialEntries={["/qr-menu/hillcafe"]}>
      <Routes>
        <Route path="/qr-menu/:tenantSlug" element={<QrMenuPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QrMenuPage — POS-137 kitchen operating hours & per-section serving schedules", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("shows kitchen closed banner and disables out-of-window dishes with servingWindowLabel", async () => {
    renderMenu({
      tenantName: "Hill Cafe",
      tenantSlug: "hillcafe",
      currency: "INR",
      tableCode: "T4",
      roomLinkStatus: "NONE",
      isKitchenOpen: false,
      kitchenHoursSummary: "7:00 AM – 10:30 PM",
      nextOpenLabel: "Opens at 7:00 AM",
      categories: [
        {
          categoryKey: "FNB",
          title: "Breakfast & Dining",
          items: [
            {
              id: 21,
              name: "Masala Dosa",
              price: 160,
              dietary: "VEG",
              outletCategory: "FNB",
              isSoldOut86: false,
              isAvailableNow: false,
              servingWindowLabel: "Served 7:00 AM – 11:00 AM",
            },
            {
              id: 22,
              name: "Filter Coffee",
              price: 80,
              dietary: "VEG",
              outletCategory: "FNB",
              isSoldOut86: false,
              isAvailableNow: true,
            },
          ],
        },
      ],
    });
    await settle();

    const closedBanner = screen.getByTestId("qr-kitchen-closed-banner");
    expect(closedBanner.textContent).toContain("Kitchen is currently closed");
    expect(closedBanner.textContent).toContain("Opens at 7:00 AM");
    expect(closedBanner.textContent).toContain("7:00 AM – 10:30 PM");

    const badge = screen.getByTestId("menu-item-serving-window-21");
    expect(badge.textContent).toContain("Served 7:00 AM – 11:00 AM");

    const dosaAdd = screen.getByTestId("add-to-cart-21") as HTMLButtonElement;
    expect(dosaAdd.disabled).toBe(true);
    expect(dosaAdd.textContent).toContain("Not served now");

    const coffeeAdd = screen.getByTestId("add-to-cart-22") as HTMLButtonElement;
    expect(coffeeAdd.disabled).toBe(false);
  });
});
