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

const baseMenu = {
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
      ],
    },
  ],
};

describe("QrMenuPage — POS-136 kitchen pause & busy-kitchen extra-wait banner", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("shows friendly paused banner and disables Place Order when orderingPaused is true", async () => {
    const futureIso = new Date(Date.now() + 30 * 60_000).toISOString();
    renderMenu({
      ...baseMenu,
      orderingPaused: true,
      orderingPausedUntilUtc: futureIso,
      orderingPauseMessage: "Kitchen is busy — phone ordering resumes at 8:40 PM",
    });
    await settle();

    const banner = screen.getByTestId("qr-ordering-paused-banner");
    expect(banner.textContent).toContain("Kitchen is busy — phone ordering resumes at 8:40 PM");

    fireEvent.click(screen.getByTestId("add-to-cart-10"));
    const submitBtn = screen.getByTestId("pos-qr-submit-btn") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  test("shows busy-kitchen extra-wait banner when qrPrepTimeBufferMinutes > 0", async () => {
    renderMenu({
      ...baseMenu,
      orderingPaused: false,
      estimatedPrepMinutes: 35,
      qrPrepTimeBufferMinutes: 15,
    });
    await settle();

    const banner = screen.getByTestId("qr-prep-buffer-banner");
    expect(banner.textContent).toContain("35 mins");
    expect(screen.queryByTestId("qr-ordering-paused-banner")).toBeNull();
  });
});
