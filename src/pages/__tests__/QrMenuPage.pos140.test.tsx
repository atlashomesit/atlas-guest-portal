import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("QrMenuPage — POS-140 daily portion limit & live remaining-plates badges", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("shows Only N left today, N left today, and Sold out for today badges and enforces cap", async () => {
    renderMenu({
      tenantName: "Hill Cafe",
      tenantSlug: "hillcafe",
      currency: "INR",
      tableCode: "T4",
      roomLinkStatus: "NONE",
      categories: [
        {
          categoryKey: "FNB",
          title: "Chef Specials",
          items: [
            {
              id: 31,
              name: "Sunday Biryani",
              price: 420,
              dietary: "NON_VEG",
              outletCategory: "FNB",
              isSoldOut86: false,
              dailyPortionLimit: 15,
              portionsRemaining: 2,
            },
            {
              id: 32,
              name: "Wood-Fired Pizza",
              price: 380,
              dietary: "VEG",
              outletCategory: "FNB",
              isSoldOut86: false,
              dailyPortionLimit: 12,
              portionsRemaining: 10,
            },
            {
              id: 33,
              name: "Truffle Pasta",
              price: 460,
              dietary: "VEG",
              outletCategory: "FNB",
              isSoldOut86: false,
              dailyPortionLimit: 10,
              portionsRemaining: 0,
            },
          ],
        },
      ],
    });
    await settle();

    expect((await screen.findByTestId("menu-item-portions-31")).textContent).toBe("Only 2 left today");
    expect(screen.getByTestId("menu-item-portions-32").textContent).toBe("10 left today");
    expect(screen.getByTestId("menu-item-portions-33").textContent).toBe("Sold out for today");

    const soldOutBtn = screen.getByTestId("add-to-cart-33") as HTMLButtonElement;
    expect(soldOutBtn.disabled).toBe(true);
    expect(soldOutBtn.textContent).toBe("Sold out");

    // Adding Sunday Biryani twice hits the remaining cap of 2 and disables the + button
    fireEvent.click(screen.getByTestId("add-to-cart-31"));
    const incBtn = screen.getByTestId("cart-inc-31") as HTMLButtonElement;
    expect(incBtn.disabled).toBe(false);
    fireEvent.click(incBtn);
    expect(incBtn.disabled).toBe(true);
  });
});
