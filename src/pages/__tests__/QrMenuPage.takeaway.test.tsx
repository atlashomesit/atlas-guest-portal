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
 * POS-062 (guest QR part): the plain menu link offers a Takeaway pickup choice. It is paid at the counter, needs a name and a mobile number, and sends
 * ONLY the choice - the page never names a delivery fee, a packaging charge, an address or a total (the server prices the order). Delivery is not
 * offered at all. A room or table link keeps exactly today's page.
 */

const MENU = {
  tenantName: "Coorg Plantation Resort",
  tenantSlug: "coorg-resort",
  currency: "INR",
  categories: [
    {
      categoryKey: "FNB",
      title: "F&B (Dining & Room Service)",
      items: [
        { id: 1, name: "Coorg Pandi Curry", description: "Spiced pork curry", price: 480, dietary: "NON_VEG", outletCategory: "FNB", isSoldOut86: false },
      ],
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

function postCount(): number {
  return (global.fetch as any).mock.calls.filter((c: any[]) => c[1]?.method === "POST").length;
}

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
    if (url.includes("/api/public/qr-menu/coorg-resort?") && !options?.method) {
      return Promise.resolve({ ok: true, status: 200, json: async () => MENU });
    }
    if (url.includes("/order") && options?.method === "POST") {
      const body = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          orderNumber: "POS-20261029-004",
          status: "KOT_Fired",
          liveStep: "Order Received",
          targetLabel: body.orderType === "TAKEAWAY" ? "Takeaway pickup" : "Counter Walk-In",
          orderType: body.orderType ?? null,
          settlementMethod: body.settlementMethod,
          totalAmount: 480,
          gstAmount: 22.86,
          createdAtUtc: new Date().toISOString(),
          estimatedMinutes: 15,
          kotNumber: "KOT-20261029-004",
          kotStatus: "Pending",
          whatsAppUpdates: true,
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

async function openCart(url = "/qr-menu/coorg-resort") {
  renderQrMenu(url);
  await settle();
  fireEvent.click(screen.getByTestId("add-to-cart-1"));
}

describe("POS-062: takeaway pickup on the guest QR menu", () => {
  test("the plain menu link offers At the restaurant / Takeaway pickup, and nothing about delivery", async () => {
    await openCart();

    expect(screen.getByTestId("pos-qr-fulfilment")).toBeInTheDocument();
    expect(screen.getByTestId("fulfil-here")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("fulfil-takeaway")).toHaveAttribute("aria-pressed", "false");
    // no delivery choice, no address / landmark / zone / fee fields anywhere on the page
    expect(screen.queryByText(/home delivery/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/address|landmark|pin ?code|zone/i)).toBeNull();
    expect(screen.queryByText(/delivery fee|packaging/i)).toBeNull();
  });

  test("a room link and a table link keep today's page: no takeaway choice", async () => {
    await openCart("/qr-menu/coorg-resort?room=101");
    expect(screen.queryByTestId("pos-qr-fulfilment")).toBeNull();
    cleanup();

    await openCart("/qr-menu/coorg-resort?table=T4");
    expect(screen.queryByTestId("pos-qr-fulfilment")).toBeNull();
    expect(screen.getByTestId("settle-pay-on-delivery")).toBeInTheDocument();
    cleanup();

    await openCart("/qr-menu/coorg-resort?rk=abcDEF1234567890abcDEF");
    expect(screen.queryByTestId("pos-qr-fulfilment")).toBeNull();
  });

  test("default (At the restaurant) sends exactly what it sent before: no order type, the chosen settlement", async () => {
    await openCart();
    fireEvent.click(screen.getByTestId("settle-pay-on-delivery"));
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    const body = postedBody();
    expect(body.orderType).toBeUndefined();
    expect(body.settlementMethod).toBe("PAY_ON_DELIVERY");
    expect(screen.getByTestId("pos-qr-live-tracker")).toBeInTheDocument();
  });

  test("choosing Takeaway pickup swaps the payment choice for a pay-at-the-counter note and asks for a name and phone", async () => {
    await openCart();
    fireEvent.click(screen.getByTestId("fulfil-takeaway"));

    expect(screen.getByTestId("fulfil-takeaway")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("pos-qr-takeaway-note")).toHaveTextContent(/pay at the counter/i);
    expect(screen.getByTestId("pos-qr-takeaway-note")).toHaveTextContent(/delivery is not available/i);
    expect(screen.queryByTestId("settle-pay-now-upi")).toBeNull();
    expect(screen.queryByTestId("settle-pay-on-delivery")).toBeNull();
    expect(screen.getByTestId("pos-qr-guest-name")).toHaveAttribute("placeholder", "Your Name");
    expect(screen.getByTestId("pos-qr-guest-phone")).toHaveAttribute("placeholder", "Mobile Number");
    expect(screen.getByTestId("pos-qr-submit-btn")).toHaveTextContent(/place takeaway order/i);

    // and switching back restores the ordinary choice
    fireEvent.click(screen.getByTestId("fulfil-here"));
    expect(screen.queryByTestId("pos-qr-takeaway-note")).toBeNull();
    expect(screen.getByTestId("settle-pay-on-delivery")).toBeInTheDocument();
  });

  test("takeaway without a name and a 10-digit mobile number is stopped on the page and sends nothing", async () => {
    await openCart();
    fireEvent.click(screen.getByTestId("fulfil-takeaway"));

    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();
    expect(screen.getByTestId("pos-qr-room-verification-error")).toHaveTextContent(/name and a 10-digit mobile number/i);
    expect(postCount()).toBe(0);

    fireEvent.change(screen.getByTestId("pos-qr-guest-name"), { target: { value: "Meera Nair" } });
    fireEvent.change(screen.getByTestId("pos-qr-guest-phone"), { target: { value: "98765" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();
    expect(postCount()).toBe(0);
  });

  test("a takeaway order sends the choice, the contact details and pay-at-counter - and no fee, packaging, address, zone or total", async () => {
    await openCart();
    fireEvent.click(screen.getByTestId("fulfil-takeaway"));
    fireEvent.change(screen.getByTestId("pos-qr-guest-name"), { target: { value: "Meera Nair" } });
    fireEvent.change(screen.getByTestId("pos-qr-guest-phone"), { target: { value: "98765 43210" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    const body = postedBody();
    expect(body.orderType).toBe("TAKEAWAY");
    expect(body.settlementMethod).toBe("PAY_ON_DELIVERY");
    expect(body.guestName).toBe("Meera Nair");
    expect(body.guestPhone).toBe("98765 43210");
    expect(body.verificationCode).toBeUndefined();
    expect(body.roomKey).toBeUndefined();
    for (const key of ["deliveryFee", "packagingCharge", "deliveryAddress", "deliveryLandmark", "deliveryZoneId", "totalAmount", "gstAmount", "taxMode"]) {
      expect(Object.keys(body)).not.toContain(key);
    }

    // the tracker names it and says how it is paid; it shows no phone number
    expect(screen.getByTestId("pos-qr-live-tracker")).toBeInTheDocument();
    expect(screen.getByText("Takeaway pickup")).toBeInTheDocument();
    expect(screen.getByText("Pay at the counter when you collect")).toBeInTheDocument();
    expect(screen.queryByText(/98765/)).toBeNull();
  });

  test("a refusal from the server is shown to the guest and the cart is kept", async () => {
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes("/api/public/qr-menu/coorg-resort?") && !options?.method) {
        return Promise.resolve({ ok: true, status: 200, json: async () => MENU });
      }
      if (url.includes("/order") && options?.method === "POST") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ code: "PHONE_INVALID", error: "The mobile number is not valid. Enter a 10-digit mobile number." }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    await openCart();
    fireEvent.click(screen.getByTestId("fulfil-takeaway"));
    fireEvent.change(screen.getByTestId("pos-qr-guest-name"), { target: { value: "Meera Nair" } });
    fireEvent.change(screen.getByTestId("pos-qr-guest-phone"), { target: { value: "0000000000" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    expect(screen.getByTestId("pos-qr-room-verification-error")).toHaveTextContent(/mobile number is not valid/i);
    expect(screen.queryByTestId("pos-qr-live-tracker")).toBeNull();
    expect(screen.getByTestId("pos-qr-cart-drawer")).toBeInTheDocument();
  });
});
