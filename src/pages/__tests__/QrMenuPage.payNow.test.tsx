/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import QrMenuPage from "../QrMenuPage";
import { canPayNow } from "../../components/qrmenu/payNow";
import { settle } from "@/test/settle";

/**
 * POS-067 (guest QR part): an unsettled order on /qr-menu/:slug?order=... shows "Pay now". It asks the API to create the Razorpay order (the page sends only the
 * order number - never an amount), opens Razorpay Checkout with the order the API returned, and hands what Checkout returns to verify-payment. Any refusal
 * is shown in words and the order stays unpaid; a settled order shows no button.
 */

const MENU = {
  tenantName: "Coorg Plantation Resort",
  tenantSlug: "coorg-resort",
  currency: "INR",
  categories: [{ categoryKey: "FNB", title: "F&B", items: [{ id: 1, name: "Coorg Pandi Curry", description: "Curry", price: 480, dietary: "NON_VEG", outletCategory: "FNB", isSoldOut86: false }] }],
};

const unsettledOrder = (over: Record<string, unknown> = {}) => ({
  orderNumber: "POS-20261029-007",
  status: "KOT_Fired",
  liveStep: "Preparing in Kitchen",
  targetLabel: "Table T4",
  settlementMethod: "PAY_ON_DELIVERY",
  totalAmount: 480,
  gstAmount: 22.86,
  amountDue: 480,
  createdAtUtc: new Date().toISOString(),
  estimatedMinutes: 15,
  kotNumber: "KOT-1",
  kotStatus: "Pending",
  whatsAppUpdates: false,
  lines: [{ id: 1, itemName: "Coorg Pandi Curry", quantity: 1, unitPrice: 480, totalPrice: 480 }],
  ...over,
});

type Handler = (url: string, init?: any) => any;

function mockFetch(order: () => Record<string, unknown>, onPost: Handler) {
  global.fetch = vi.fn().mockImplementation((url: string, init?: any) => {
    if (init?.method === "POST") return Promise.resolve(onPost(url, init));
    if (url.includes("/order/POS-20261029-007")) return Promise.resolve({ ok: true, status: 200, json: async () => order() });
    if (url.includes("/api/public/qr-menu/coorg-resort?")) return Promise.resolve({ ok: true, status: 200, json: async () => MENU });
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  }) as any;
}

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const refused = (status: number, body: unknown) => ({ ok: false, status, json: async () => body });

const CREATED = { orderId: "order_RzpReal0001", keyId: "rzp_test_key", amount: 480, amountInPaise: 48000, currency: "INR", posOrderId: 7101, orderNumber: "POS-20261029-007" };

let checkoutOptions: any;
let failHandler: (() => void) | null;

function installRazorpay() {
  failHandler = null;
  (window as any).Razorpay = vi.fn().mockImplementation(function (this: any, options: any) {
    checkoutOptions = options;
    this.open = () => {};
    this.on = (event: string, h: () => void) => { if (event === "payment.failed") failHandler = h; };
  });
}

function renderOrder() {
  return render(
    <MemoryRouter initialEntries={["/qr-menu/coorg-resort?order=POS-20261029-007"]}>
      <Routes>
        <Route path="/qr-menu/:tenantSlug" element={<QrMenuPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const posts = () => (global.fetch as any).mock.calls.filter((c: any[]) => c[1]?.method === "POST");

beforeEach(() => {
  vi.restoreAllMocks();
  installRazorpay();
});

afterEach(() => {
  cleanup();
  delete (window as any).Razorpay;
});

describe("POS-067 canPayNow", () => {
  test("only an order the API says still owes money, that is not settled, voided or posted to a room", () => {
    expect(canPayNow({ status: "KOT_Fired", settlementMethod: "PAY_ON_DELIVERY", amountDue: 480 })).toBe(true);
    expect(canPayNow({ status: "PartiallySettled", settlementMethod: "MultiTender", amountDue: 120 })).toBe(true);
    expect(canPayNow({ status: "Settled", amountDue: 480 })).toBe(false);
    expect(canPayNow({ status: "Voided", amountDue: 480 })).toBe(false);
    expect(canPayNow({ status: "PostedToRoom", amountDue: 480 })).toBe(false);
    expect(canPayNow({ status: "KOT_Fired", settlementMethod: "POST_TO_ROOM", amountDue: 480 })).toBe(false);
    expect(canPayNow({ status: "KOT_Fired", amountDue: 0 })).toBe(false);
    expect(canPayNow({ status: "KOT_Fired" })).toBe(false); // an API that does not send amountDue never shows the button
  });
});

describe("POS-067 Pay now on the guest QR page", () => {
  test("an unsettled order shows Pay now with the API's amount; a settled one does not", async () => {
    mockFetch(() => unsettledOrder(), () => ok({}));
    renderOrder();
    await settle();
    expect(screen.getByTestId("pos-qr-pay-now-btn")).toHaveTextContent("Pay now ₹480");
    cleanup();

    mockFetch(() => unsettledOrder({ status: "Settled", amountDue: 0, liveStep: "Served" }), () => ok({}));
    renderOrder();
    await settle();
    expect(screen.queryByTestId("pos-qr-pay-now")).toBeNull();
  });

  test("Pay now asks the API for the order (order number only, no amount), opens Checkout with the API's Razorpay order, then verifies and shows paid", async () => {
    let settled = false;
    mockFetch(
      () => (settled ? unsettledOrder({ status: "Settled", amountDue: 0, liveStep: "Served", settlementMethod: "PAY_NOW_UPI" }) : unsettledOrder()),
      (url) => {
        if (url.endsWith("/create-payment-order")) return ok(CREATED);
        if (url.endsWith("/verify-payment")) { settled = true; return ok({ success: true, status: "Settled", posOrderId: 7101, orderNumber: "POS-20261029-007" }); }
        throw new Error(`unexpected POST ${url}`);
      },
    );
    renderOrder();
    await settle();

    fireEvent.click(screen.getByTestId("pos-qr-pay-now-btn"));
    await settle();

    // The page sent the order number and nothing money-shaped.
    expect(JSON.parse(posts()[0][1].body)).toEqual({ orderNumber: "POS-20261029-007" });
    // Checkout opens with the order and key the API created.
    expect(checkoutOptions).toMatchObject({ key: "rzp_test_key", order_id: "order_RzpReal0001", amount: 48000, currency: "INR" });
    expect(posts()).toHaveLength(1); // not settled until Checkout returns

    checkoutOptions.handler({ razorpay_order_id: "order_RzpReal0001", razorpay_payment_id: "pay_Real0001", razorpay_signature: "sig123" });
    await settle();

    expect(JSON.parse(posts()[1][1].body)).toEqual({
      razorpayOrderId: "order_RzpReal0001", razorpayPaymentId: "pay_Real0001", razorpaySignature: "sig123", posOrderId: 7101, orderNumber: "POS-20261029-007",
    });
    expect(screen.getByTestId("pos-qr-pay-now-paid")).toBeInTheDocument();
  });

  test("a refusal when the order cannot be created is shown in words, Checkout never opens and the button comes back", async () => {
    mockFetch(() => unsettledOrder(), () => refused(409, { code: "PAYMENT_NOT_CONFIGURED", error: "Online payment is not set up for this property, so this payment cannot be confirmed. Please pay at the counter or on delivery." }));
    renderOrder();
    await settle();

    fireEvent.click(screen.getByTestId("pos-qr-pay-now-btn"));
    await settle();

    expect(screen.getByTestId("pos-qr-pay-now-message")).toHaveTextContent("Online payment is not set up for this property");
    expect((window as any).Razorpay).not.toHaveBeenCalled();
    expect(screen.getByTestId("pos-qr-pay-now-btn")).not.toBeDisabled();
  });

  test("when verify-payment refuses (amount mismatch), the order is not shown as paid and the words say so", async () => {
    mockFetch(
      () => unsettledOrder(),
      (url) => (url.endsWith("/create-payment-order") ? ok(CREATED) : refused(409, { code: "PAYMENT_MISMATCH", error: "This payment does not match the order, so nothing was settled. Please show this to the staff." })),
    );
    renderOrder();
    await settle();
    fireEvent.click(screen.getByTestId("pos-qr-pay-now-btn"));
    await settle();

    checkoutOptions.handler({ razorpay_order_id: "order_RzpReal0001", razorpay_payment_id: "pay_Real0001", razorpay_signature: "sig123" });
    await settle();

    expect(screen.getByTestId("pos-qr-pay-now-message")).toHaveTextContent("does not match the order");
    expect(screen.queryByTestId("pos-qr-pay-now-paid")).toBeNull();
    expect(screen.getByTestId("pos-qr-pay-now-btn")).toBeInTheDocument();
  });

  test("closing Checkout or a failed payment leaves the order unpaid with a plain message, and verify is never called", async () => {
    mockFetch(() => unsettledOrder(), (url) => (url.endsWith("/create-payment-order") ? ok(CREATED) : ok({ success: true })));
    renderOrder();
    await settle();
    fireEvent.click(screen.getByTestId("pos-qr-pay-now-btn"));
    await settle();

    checkoutOptions.modal.ondismiss();
    await settle();

    expect(screen.getByTestId("pos-qr-pay-now-message")).toHaveTextContent("You have not been charged");
    expect(posts()).toHaveLength(1);
    expect(screen.queryByTestId("pos-qr-pay-now-paid")).toBeNull();

    fireEvent.click(screen.getByTestId("pos-qr-pay-now-btn"));
    await settle();
    failHandler?.();
    await settle();
    expect(screen.getByTestId("pos-qr-pay-now-message")).toHaveTextContent("did not go through");
    expect(posts()).toHaveLength(2); // a second create for the retry, still no verify
  });
});
