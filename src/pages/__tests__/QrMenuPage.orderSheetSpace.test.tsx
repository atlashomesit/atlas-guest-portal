/**
 * @vitest-environment jsdom
 *
 * The order sheet is fixed to the bottom of the screen and can take most of it. While an order is open the page must reserve exactly the
 * sheet's height below the menu, or the last dishes (and, on a short screen, every dish) sit behind the sheet and a guest cannot add a
 * second line, such as the same drink with a different choice.
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import QrMenuPage from "../QrMenuPage";
import { settle } from "@/test/settle";

const MENU = {
  tenantName: "Coorg Plantation Resort",
  tenantSlug: "coorg-resort",
  currency: "INR",
  roomLabel: null,
  listingId: null,
  roomLinkStatus: "NONE",
  roomChargeLocked: false,
  roomChargeFallbackMethods: [],
  categories: [
    {
      categoryKey: "FNB",
      title: "F&B (Dining & Room Service)",
      items: [{ id: 1, name: "Akki Roti (2 pcs)", price: 160, dietary: "VEG", outletCategory: "FNB", isSoldOut86: false }],
    },
  ],
};

const SHEET_HEIGHT = 506;

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn().mockImplementation((url: string) =>
    url.includes("/api/public/qr-menu/coorg-resort?")
      ? Promise.resolve({ ok: true, status: 200, json: async () => MENU, headers: new Headers() })
      : Promise.reject(new Error(`Unhandled URL: ${url}`)),
  ) as any;
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("data-testid") === "pos-qr-cart-drawer" ? SHEET_HEIGHT : 0;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderQrMenu() {
  return render(
    <MemoryRouter initialEntries={["/qr-menu/coorg-resort?table=T4"]}>
      <Routes>
        <Route path="/qr-menu/:tenantSlug" element={<QrMenuPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QR menu: room below the menu for the open order sheet", () => {
  test("with no order the page keeps its 120px floor; with an order it reserves the sheet's height plus a margin, and gives it back when the order is emptied", async () => {
    renderQrMenu();
    await settle();
    const page = screen.getByTestId("pos-qr-menu-page");
    expect(page.style.paddingBottom).toBe("120px");

    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    await settle();
    expect(screen.getByTestId("pos-qr-cart-drawer")).toBeInTheDocument();
    expect(page.style.paddingBottom).toBe(`${SHEET_HEIGHT + 24}px`);

    fireEvent.click(screen.getByLabelText("Remove one Akki Roti (2 pcs)"));
    await settle();
    expect(screen.queryByTestId("pos-qr-cart-drawer")).toBeNull();
    expect(page.style.paddingBottom).toBe("120px");
  });
});
