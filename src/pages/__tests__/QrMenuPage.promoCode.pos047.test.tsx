/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import QrMenuPage from "../QrMenuPage";
import { settle } from "@/test/settle";

/**
 * POS-047 L3 (guest QR part, FOUNDER ruled 2026-10-30 option A): a host's promo code (made for the restaurant bill) can be typed on the QR order.
 * The page sends only the code; the server checks it and takes the amount off the food bill before GST. The page never works out a discount.
 * A room charge refuses a promo code on the server, so the field is not offered there.
 */

const MENU = {
  tenantName: "Coorg Plantation Resort",
  tenantSlug: "coorg-resort",
  currency: "INR",
  categories: [
    {
      categoryKey: "FNB",
      title: "F&B (Dining & Room Service)",
      items: [{ id: 1, name: "Coorg Pandi Curry", description: "Spiced pork curry", price: 480, dietary: "NON_VEG", outletCategory: "FNB", isSoldOut86: false }],
    },
  ],
};

function renderQrMenu(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/qr-menu/:tenantSlug" element={<QrMenuPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function postedBody(): Record<string, unknown> {
  const call = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === "POST");
  return JSON.parse(call[1].body);
}

function installFetch(orderResponse: (body: any) => any) {
  global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
    if (url.includes("/api/public/qr-menu/coorg-resort?") && !options?.method) {
      return Promise.resolve({ ok: true, status: 200, json: async () => MENU });
    }
    if (url.includes("/order") && options?.method === "POST") {
      return Promise.resolve(orderResponse(JSON.parse(options.body)));
    }
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  }) as any;
}

const okOrder = (body: any) => ({
  ok: true,
  status: 201,
  json: async () => ({
    orderNumber: "POS-20261030-002",
    status: "KOT_Fired",
    liveStep: "Order Received",
    targetLabel: "Table T4",
    settlementMethod: body.settlementMethod,
    totalAmount: 456,
    gstAmount: 21.71,
    createdAtUtc: new Date().toISOString(),
    estimatedMinutes: 15,
    kotNumber: "KOT-1",
    kotStatus: "Pending",
    whatsAppUpdates: true,
    lines: body.lines,
  }),
});

beforeEach(() => {
  vi.restoreAllMocks();
  installFetch(okOrder);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openCart(url = "/qr-menu/coorg-resort?table=T4") {
  renderQrMenu(url);
  await settle();
  fireEvent.click(screen.getByTestId("add-to-cart-1"));
}

describe("POS-047 L3: promo code on the guest QR order", () => {
  test("a table order offers an optional promo code field, empty by default, and an order without a code sends no promoCode", async () => {
    await openCart();
    expect(screen.getByTestId("pos-qr-promo-code")).toHaveValue("");
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    expect(postedBody().promoCode).toBeUndefined();
    expect(screen.getByTestId("pos-qr-live-tracker")).toBeInTheDocument();
  });

  test("a typed code is sent in capitals, trimmed, and nothing else about money is sent with it", async () => {
    await openCart();
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));
    fireEvent.change(screen.getByTestId("pos-qr-promo-code"), { target: { value: "  cafe20 " } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    const body = postedBody();
    expect(body.promoCode).toBe("CAFE20");
    for (const key of ["discountAmount", "discount", "totalAmount", "gstAmount", "taxMode"]) {
      expect(Object.keys(body)).not.toContain(key);
    }
  });

  test("a code the server refuses shows the server's words, keeps the cart and the typed code, and shows no tracker", async () => {
    installFetch(() => ({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({ code: "PROMO_NOT_FOR_POS", error: "This promo code cannot be used on a restaurant or café bill." }),
    }));
    await openCart();
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));
    fireEvent.change(screen.getByTestId("pos-qr-promo-code"), { target: { value: "ROOMS10" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    expect(screen.getByTestId("pos-qr-room-verification-error")).toHaveTextContent("This promo code cannot be used on a restaurant or café bill.");
    expect(screen.getByTestId("pos-qr-promo-code")).toHaveValue("ROOMS10");
    expect(screen.queryByTestId("pos-qr-live-tracker")).toBeNull();
    expect(screen.getByTestId("pos-qr-submit-btn")).toBeInTheDocument();
  });

  test("the field is cleared once the order is placed", async () => {
    await openCart();
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));
    fireEvent.change(screen.getByTestId("pos-qr-promo-code"), { target: { value: "CAFE20" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    expect(screen.getByTestId("pos-qr-live-tracker")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    expect(screen.getByTestId("pos-qr-promo-code")).toHaveValue("");
  });

  test("charging the order to a room offers no promo code field and never sends one (the server refuses a code on a room charge)", async () => {
    await openCart("/qr-menu/coorg-resort?room=101");
    // a room link starts on Charge to Room: no promo field there
    expect(screen.queryByTestId("pos-qr-promo-code")).toBeNull();

    // choosing another way to pay brings the field; typing a code, then going back to the room charge hides it and drops the code
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));
    fireEvent.change(screen.getByTestId("pos-qr-promo-code"), { target: { value: "CAFE20" } });
    fireEvent.click(screen.getByTestId("settle-post-to-room"));
    expect(screen.queryByTestId("pos-qr-promo-code")).toBeNull();

    fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "1234" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    expect(postedBody().settlementMethod).toBe("POST_TO_ROOM");
    expect(postedBody().promoCode).toBeUndefined();
  });
});
