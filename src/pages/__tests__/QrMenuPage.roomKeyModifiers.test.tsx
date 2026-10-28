/**
 * @vitest-environment jsdom
 *
 * POS-011 (guest half): the printed room QR is `/qr-menu/:slug?rk=<key>`; the page sends the key, shows the API's room-link
 * status, the lockout (with the retry time), and never retries a locked order by itself.
 * POS-017 (guest half): per-item modifier groups with a picker that enforces min / max / required, the choices go on the order,
 * and every price shown comes from the API (menu price plus deltas; no tax maths in the browser).
 */
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import QrMenuPage from "../QrMenuPage";
import { settle } from "@/test/settle";

const PLAIN_ITEM = { id: 1, name: "Akki Roti (2 pcs)", price: 160, dietary: "VEG", outletCategory: "FNB", isSoldOut86: false };
const COFFEE = {
  id: 11,
  name: "Cappuccino",
  price: 200,
  dietary: "VEG",
  outletCategory: "FNB",
  isSoldOut86: false,
  modifierGroups: [
    {
      id: "g-milk",
      name: "Milk choice",
      minSelection: 1,
      maxSelection: 1,
      options: [
        { id: "o-dairy", name: "Dairy milk", priceDelta: 0, isAvailable: true },
        { id: "o-oat", name: "Oat milk", priceDelta: 40, dietaryFlag: "VEGAN", isAvailable: true },
        { id: "o-gone", name: "Almond milk", priceDelta: 50, isAvailable: false },
      ],
    },
    {
      id: "g-extra",
      name: "Extras",
      minSelection: 0,
      maxSelection: 2,
      options: [
        { id: "o-shot", name: "Extra shot", priceDelta: 30, isAvailable: true },
        { id: "o-syrup", name: "Vanilla syrup", priceDelta: 20, isAvailable: true },
        { id: "o-choc", name: "Chocolate", priceDelta: 25, isAvailable: true },
      ],
    },
  ],
};
const IMPOSSIBLE = {
  id: 12,
  name: "Tasting Flight",
  price: 500,
  dietary: "NA",
  outletCategory: "FNB",
  isSoldOut86: false,
  modifierGroups: [
    { id: "g-pick", name: "Pick three", minSelection: 3, maxSelection: 3, options: [{ id: "only", name: "Only one", priceDelta: 0, isAvailable: true }] },
  ],
};

function makeMenu(extra: Record<string, unknown> = {}) {
  return {
    tenantName: "Coorg Plantation Resort",
    tenantSlug: "coorg-resort",
    currency: "INR",
    roomLabel: "Villa 101",
    listingId: 101,
    roomLinkStatus: "KEY",
    roomChargeLocked: false,
    roomChargeFallbackMethods: [],
    categories: [{ categoryKey: "FNB", title: "F&B (Dining & Room Service)", items: [PLAIN_ITEM, COFFEE, IMPOSSIBLE] }],
    ...extra,
  };
}

const ASK_FRONT_DESK = "This room's QR link is no longer valid. Please ask the front desk for the current QR code.";
const LOCK_ERROR =
  "Too many wrong codes were tried for this room, so charging it to the room is paused. Please pay now or pay on delivery, or ask the front desk.";
const LOCKED_UNTIL = "2026-10-29T10:45:00Z";
const retryTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, headers: new Headers() });

type OrderHandler = (body: any) => ReturnType<typeof reply>;
let menuResponse: () => ReturnType<typeof reply>;
let orderHandler: OrderHandler;

function successOrder(body: any, overrides: Record<string, unknown> = {}) {
  return reply(201, {
    orderNumber: "POS-20261029-001",
    status: "KOT_Fired",
    liveStep: "Order Received",
    targetLabel: "Villa 101",
    settlementMethod: body.settlementMethod,
    totalAmount: 0,
    gstAmount: 0,
    createdAtUtc: new Date().toISOString(),
    estimatedMinutes: 15,
    kotNumber: "KOT-1",
    lines: [],
    ...overrides,
  });
}

function getCalls(): string[] {
  return (global.fetch as any).mock.calls.filter((c: any[]) => !c[1]?.method || c[1].method === "GET").map((c: any[]) => String(c[0]));
}
function postBodies(): any[] {
  return (global.fetch as any).mock.calls.filter((c: any[]) => c[1]?.method === "POST").map((c: any[]) => JSON.parse(c[1].body));
}

function renderQrMenu(url: string) {
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
  menuResponse = () => reply(200, makeMenu());
  orderHandler = (body) => successOrder(body);
  global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
    if (options?.method === "POST" && url.includes("/order")) return Promise.resolve(orderHandler(JSON.parse(options.body)));
    if (url.includes("/api/public/qr-menu/coorg-resort?")) return Promise.resolve(menuResponse());
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  }) as any;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("POS-011: room key on the guest QR menu", () => {
  test("?rk= is sent to the menu, the resolved room is used, and the order carries roomKey", async () => {
    renderQrMenu("/qr-menu/coorg-resort?rk=KEY22charsKEY22charsAB");
    await settle();

    const menuUrl = getCalls().find((u) => u.includes("/api/public/qr-menu/coorg-resort?"))!;
    expect(menuUrl).toContain("rk=KEY22charsKEY22charsAB");
    expect(menuUrl).not.toContain("room=");
    expect(screen.getByText("Villa 101")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    expect(screen.getByTestId("settle-post-to-room")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "4829" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    const [body] = postBodies();
    expect(body.roomKey).toBe("KEY22charsKEY22charsAB");
    expect(body.listingId).toBe(101);
    expect(body.settlementMethod).toBe("POST_TO_ROOM");
    expect(body.verificationCode).toBe("4829");
    expect(screen.getByTestId("pos-qr-live-tracker")).toBeInTheDocument();
  });

  test("a legacy ?room= link inside its 30-day window keeps working and sends no roomKey", async () => {
    menuResponse = () => reply(200, makeMenu({ roomLinkStatus: "LEGACY", legacyLinkExpiresAtUtc: "2026-11-20T00:00:00Z" }));
    renderQrMenu("/qr-menu/coorg-resort?room=101");
    await settle();

    expect(getCalls().find((u) => u.includes("/api/public/qr-menu/coorg-resort?"))).toContain("room=101");
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    expect(screen.getByTestId("settle-post-to-room")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "4829" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    const [body] = postBodies();
    expect(body.listingId).toBe(101);
    expect(body.roomKey).toBeUndefined();
    expect(body.settlementMethod).toBe("POST_TO_ROOM");
  });

  test("EXPIRED numeric link: says to ask the front desk, hides Post to Room, offers Pay Now / Pay on Delivery", async () => {
    menuResponse = () =>
      reply(
        200,
        makeMenu({
          listingId: null,
          roomLabel: null,
          roomLinkStatus: "EXPIRED",
          roomLinkMessage: ASK_FRONT_DESK,
          roomChargeFallbackMethods: ["PAY_NOW_UPI", "PAY_ON_DELIVERY"],
        })
      );
    renderQrMenu("/qr-menu/coorg-resort?room=101");
    await settle();

    expect(screen.getByTestId("pos-qr-room-link-notice")).toHaveTextContent(ASK_FRONT_DESK);
    expect(screen.getByTestId("pos-qr-room-link-notice")).toHaveTextContent(/Pay Now|pay now/);

    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    expect(screen.queryByTestId("settle-post-to-room")).toBeNull();
    expect(screen.queryByTestId("pos-qr-room-guardrail-section")).toBeNull();
    expect(screen.getByTestId("settle-pay-now-upi")).toBeInTheDocument();
    expect(screen.getByTestId("settle-pay-on-delivery")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();
    const [body] = postBodies();
    expect(body.settlementMethod).toBe("PAY_NOW_UPI");
    expect(body.listingId).toBeUndefined();
    expect(body.roomKey).toBeUndefined();
    expect(body.verificationCode).toBeUndefined();
  });

  test("INVALID room key: same friendly message, no room charge", async () => {
    menuResponse = () =>
      reply(
        200,
        makeMenu({ listingId: null, roomLabel: null, roomLinkStatus: "INVALID", roomLinkMessage: ASK_FRONT_DESK, roomChargeFallbackMethods: ["PAY_NOW_UPI", "PAY_ON_DELIVERY"] })
      );
    renderQrMenu("/qr-menu/coorg-resort?rk=stale");
    await settle();

    expect(screen.getByTestId("pos-qr-room-link-notice")).toHaveTextContent(ASK_FRONT_DESK);
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    expect(screen.queryByTestId("settle-post-to-room")).toBeNull();
    expect(screen.getByTestId("settle-pay-now-upi")).toBeInTheDocument();
  });

  test("room-charge locked when the menu loads: shows the retry time, hides Post to Room", async () => {
    menuResponse = () =>
      reply(200, makeMenu({ roomChargeLocked: true, roomChargeLockedUntilUtc: LOCKED_UNTIL, roomChargeFallbackMethods: ["PAY_NOW_UPI", "PAY_ON_DELIVERY"] }));
    renderQrMenu("/qr-menu/coorg-resort?rk=KEY");
    await settle();

    const notice = screen.getByTestId("pos-qr-room-locked-notice");
    expect(notice).toHaveTextContent(retryTime(LOCKED_UNTIL));
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    expect(screen.queryByTestId("settle-post-to-room")).toBeNull();
    expect(screen.getByTestId("settle-pay-now-upi")).toBeInTheDocument();
    expect(screen.getByTestId("settle-pay-on-delivery")).toBeInTheDocument();
  });

  test("403 ROOM_CHARGE_LOCKED on the order: shows the lockout and retry time, switches to Pay Now, never retries by itself", async () => {
    orderHandler = (body) =>
      body.settlementMethod === "POST_TO_ROOM"
        ? reply(403, { code: "ROOM_CHARGE_LOCKED", error: LOCK_ERROR, lockedUntilUtc: LOCKED_UNTIL, retryAfterSeconds: 900, alternatives: ["PAY_NOW_UPI", "PAY_ON_DELIVERY"] })
        : successOrder(body);
    renderQrMenu("/qr-menu/coorg-resort?rk=KEY");
    await settle();

    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "1111" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    const notice = screen.getByTestId("pos-qr-room-locked-notice");
    expect(notice).toHaveTextContent(LOCK_ERROR);
    expect(notice).toHaveTextContent(retryTime(LOCKED_UNTIL));
    expect(screen.queryByTestId("settle-post-to-room")).toBeNull();
    expect(screen.getByTestId("pos-qr-cart-drawer")).toBeInTheDocument(); // the cart is kept so the guest can pay now
    expect(screen.queryByTestId("pos-qr-live-tracker")).toBeNull();

    await settle();
    await settle();
    expect(postBodies()).toHaveLength(1); // no automatic retry
  });

  test("'Check again' re-reads the menu on the guest's tap and brings Post to Room back once the lock is over", async () => {
    orderHandler = () => reply(403, { code: "ROOM_CHARGE_LOCKED", error: LOCK_ERROR, lockedUntilUtc: LOCKED_UNTIL, retryAfterSeconds: 900, alternatives: ["PAY_NOW_UPI", "PAY_ON_DELIVERY"] });
    renderQrMenu("/qr-menu/coorg-resort?rk=KEY");
    await settle();
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "1111" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();
    expect(screen.queryByTestId("settle-post-to-room")).toBeNull();

    const menuReadsBefore = getCalls().length;
    fireEvent.click(screen.getByTestId("pos-qr-room-lock-recheck"));
    await settle();

    expect(getCalls().length).toBe(menuReadsBefore + 1);
    expect(screen.queryByTestId("pos-qr-room-locked-notice")).toBeNull();
    expect(screen.getByTestId("settle-post-to-room")).toBeInTheDocument();
    expect(postBodies()).toHaveLength(1);
  });

  test("403 ROOM_LINK_EXPIRED on the order: ask-the-front-desk notice and the pay-now options", async () => {
    orderHandler = () => reply(403, { code: "ROOM_LINK_EXPIRED", error: ASK_FRONT_DESK, alternatives: ["PAY_NOW_UPI", "PAY_ON_DELIVERY"] });
    renderQrMenu("/qr-menu/coorg-resort?room=101");
    await settle();
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "4829" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    expect(screen.getByTestId("pos-qr-room-link-notice")).toHaveTextContent(ASK_FRONT_DESK);
    expect(screen.queryByTestId("settle-post-to-room")).toBeNull();
    expect(screen.getByTestId("settle-pay-now-upi")).toBeInTheDocument();
    expect(postBodies()).toHaveLength(1);
  });

  test("a wrong code shows how many tries are left before room charge pauses", async () => {
    orderHandler = () =>
      reply(403, { code: "ROOM_VERIFICATION_FAILED", error: "Room verification failed: Room does not have an active CheckedIn booking today, or the phone last-4 / PIN did not match.", attemptsRemaining: 3 });
    renderQrMenu("/qr-menu/coorg-resort?rk=KEY");
    await settle();
    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    fireEvent.change(screen.getByTestId("pos-qr-verification-input"), { target: { value: "9999" } });
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    expect(screen.getByTestId("pos-qr-room-verification-error")).toBeInTheDocument();
    expect(screen.getByTestId("pos-qr-attempts-remaining")).toHaveTextContent("3 tries left");
    expect(screen.getByTestId("settle-post-to-room")).toBeInTheDocument(); // not locked yet
  });
});

describe("POS-017: modifier groups on the guest QR menu", () => {
  beforeEach(() => {
    // A table QR: no room, so the guest pays now / on delivery.
    menuResponse = () => reply(200, makeMenu({ listingId: null, roomLabel: null, roomLinkStatus: "NONE" }));
  });

  function openCoffeePicker() {
    fireEvent.click(screen.getByTestId("add-to-cart-11"));
    return within(screen.getByTestId("modifier-picker-11"));
  }

  test("an item with groups opens a picker (only available options) instead of adding straight away; plain items still add directly", async () => {
    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();

    fireEvent.click(screen.getByTestId("add-to-cart-1"));
    expect(screen.getByTestId("pos-qr-cart-drawer")).toBeInTheDocument();
    cleanup();

    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();
    const picker = openCoffeePicker();
    expect(screen.queryByTestId("pos-qr-cart-drawer")).toBeNull();
    expect(picker.getByText("Milk choice")).toBeInTheDocument();
    expect(picker.getByText("Extras")).toBeInTheDocument();
    expect(picker.getByRole("radio", { name: /Oat milk/ })).toBeInTheDocument();
    expect(picker.getByText("+₹40")).toBeInTheDocument();
    expect(picker.queryByText(/Almond milk/)).toBeNull(); // unavailable option is never offered
    expect(picker.getAllByRole("checkbox")).toHaveLength(3);
  });

  test("a required group blocks the add with a plain message", async () => {
    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();
    openCoffeePicker();

    fireEvent.click(screen.getByTestId("modifier-picker-add-11"));
    expect(screen.getByTestId("modifier-error-g-milk")).toHaveTextContent("Choose 1 option for Milk choice.");
    expect(screen.queryByTestId("pos-qr-cart-drawer")).toBeNull();
  });

  test("the maximum is enforced, the choices are priced from menu price plus deltas, and the order sends ids only", async () => {
    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();
    const picker = openCoffeePicker();

    fireEvent.click(picker.getByRole("radio", { name: /Oat milk/ }));
    fireEvent.click(picker.getByRole("checkbox", { name: /Extra shot/ }));
    fireEvent.click(picker.getByRole("checkbox", { name: /Vanilla syrup/ }));
    fireEvent.click(picker.getByRole("checkbox", { name: /Chocolate/ }));
    expect(picker.getByRole("checkbox", { name: /Chocolate/ })).not.toBeChecked();
    expect(screen.getByTestId("modifier-error-g-extra")).toHaveTextContent("You can choose at most 2 for Extras.");

    fireEvent.click(screen.getByTestId("modifier-picker-add-11"));
    expect(screen.getByTestId("pos-qr-cart-drawer")).toBeInTheDocument();
    expect(screen.queryByTestId("modifier-picker-11")).toBeNull();
    expect(screen.getByTestId("pos-qr-total").textContent).toContain("290"); // 200 + 40 + 30 + 20
    const line = screen.getByTestId("pos-qr-cart-line");
    expect(line).toHaveTextContent("Cappuccino");
    expect(line).toHaveTextContent("Milk choice: Oat milk (+₹40)");
    expect(line).toHaveTextContent("Extras: Extra shot (+₹30), Vanilla syrup (+₹20)");

    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();
    const [body] = postBodies();
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].addOnServiceId).toBe(11);
    expect(body.lines[0].quantity).toBe(1);
    expect(body.lines[0].unitPrice).toBe(200); // the menu price; the server adds the deltas itself
    expect(body.lines[0].modifiers).toEqual([
      { groupId: "g-milk", optionId: "o-oat" },
      { groupId: "g-extra", optionId: "o-shot" },
      { groupId: "g-extra", optionId: "o-syrup" },
    ]);
  });

  test("the same choices add to one line; different choices make a second line", async () => {
    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();

    let picker = openCoffeePicker();
    fireEvent.click(picker.getByRole("radio", { name: /Oat milk/ }));
    fireEvent.click(screen.getByTestId("modifier-picker-add-11"));

    picker = openCoffeePicker();
    fireEvent.click(picker.getByRole("radio", { name: /Oat milk/ }));
    fireEvent.click(screen.getByTestId("modifier-picker-add-11"));
    expect(screen.getAllByTestId("pos-qr-cart-line")).toHaveLength(1);
    expect(screen.getByTestId("pos-qr-total").textContent).toContain("480"); // 2 x 240

    picker = openCoffeePicker();
    fireEvent.click(picker.getByRole("radio", { name: /Dairy milk/ }));
    fireEvent.click(screen.getByTestId("modifier-picker-add-11"));
    expect(screen.getAllByTestId("pos-qr-cart-line")).toHaveLength(2);
    expect(screen.getByTestId("pos-qr-total").textContent).toContain("680"); // 2 x 240 + 200

    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();
    const [body] = postBodies();
    expect(body.lines).toHaveLength(2);
    expect(body.lines.map((l: any) => l.quantity).sort()).toEqual([1, 2]);
  });

  test("a group nobody can satisfy (needs more options than exist) cannot be ordered", async () => {
    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();
    expect(screen.getByTestId("add-to-cart-12")).toBeDisabled();
    fireEvent.click(screen.getByTestId("add-to-cart-12"));
    expect(screen.queryByTestId("modifier-picker-12")).toBeNull();
    expect(screen.queryByTestId("pos-qr-cart-drawer")).toBeNull();
  });

  test("the tracker shows the API's line text and totals as returned", async () => {
    orderHandler = (body) =>
      successOrder(body, {
        totalAmount: 252,
        gstAmount: 12,
        lines: [
          {
            id: 1,
            itemName: "Cappuccino",
            quantity: 1,
            unitPrice: 240,
            baseUnitPrice: 200,
            totalPrice: 240,
            modifiersText: "Milk choice: Oat milk (+₹40.00)",
            modifiers: [{ groupId: "g-milk", groupName: "Milk choice", optionId: "o-oat", optionName: "Oat milk", priceDelta: 40 }],
          },
        ],
      });
    renderQrMenu("/qr-menu/coorg-resort?table=T4");
    await settle();
    const picker = openCoffeePicker();
    fireEvent.click(picker.getByRole("radio", { name: /Oat milk/ }));
    fireEvent.click(screen.getByTestId("modifier-picker-add-11"));
    fireEvent.click(screen.getByTestId("pos-qr-submit-btn"));
    await settle();

    const lines = screen.getByTestId("pos-qr-order-lines");
    expect(lines).toHaveTextContent("Cappuccino");
    expect(lines).toHaveTextContent("Milk choice: Oat milk (+₹40.00)");
    expect(lines).toHaveTextContent("₹240");
    expect(screen.getByTestId("pos-qr-order-total")).toHaveTextContent("₹252");
  });
});
