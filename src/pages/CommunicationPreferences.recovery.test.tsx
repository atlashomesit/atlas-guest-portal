import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import CommunicationPreferences from "./CommunicationPreferences";
import { settle } from "../test/settle";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/tenant/displayBrand", () => ({ getTenantBrandName: () => "Test Brand" }));
vi.mock("@/api/client", () => ({ buildApiUrl: (path: string) => path, getApiHeaders: () => ({}) }));
const preferences = { transactional: true, checkInCheckoutReminders: false, postStayReviewRequest: false, promotionalOffers: true };
const consent = { purposes: [{ purpose: "marketing", label: "Optional marketing", displayText: "Offers", isGranted: true, canWithdraw: true }] };
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function renderPage() {
  render(<MemoryRouter initialEntries={["/preferences/test-token"]}><Routes><Route path="/preferences/:guestToken" element={<CommunicationPreferences />} /></Routes></MemoryRouter>);
}

describe("UXD-2026-10-27-01-A preference lookup recovery", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => undefined); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  test("unknown optional choices and Save stay gated while separately loaded consent can be withdrawn", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => String(input).includes("communication-preferences") ? response({}, 503) : response(consent));
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await settle();
    expect(screen.getByRole("button", { name: "Retry loading preferences" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.getAllByText("Unavailable", { exact: true })).toHaveLength(3);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "Transactional messages (required)" })).toBeChecked();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save preferences" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await settle();
    expect(screen.getByText("Withdrawn", { exact: true })).toBeInTheDocument();
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(String(writes[0][0])).toContain("/guest-consent/test-token/withdraw");
    expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ purpose: "marketing" });
  });

  test("repeated Retry only reads, retains retry focus, then restores authoritative values and heading focus", async () => {
    let reads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("guest-consent")) return response(consent);
      if (init?.method === "POST") return response({});
      reads += 1;
      return reads < 3 ? response({}, 503) : response(preferences);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading preferences" }));
    await settle();
    expect(screen.getByText(/Your saved preferences are still unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry loading preferences" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading preferences" }));
    await settle();
    const save = screen.getByRole("button", { name: "Save preferences" });
    expect(screen.getByRole("heading", { name: "Communication preferences", level: 1 })).toHaveFocus();
    expect(screen.getByRole("checkbox", { name: "Check-in/check-out reminders" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /WhatsApp messages/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Promotional offers/ })).toBeChecked();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    expect(reads).toBe(3);
    expect(within(screen.getByTestId("dpdp-consent-purposes")).getByRole("button", { name: "Withdraw" })).toBeEnabled();
    fireEvent.click(save);
    await settle();
    screen.getByText("Preferences updated.");
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1]!.body as string)).toEqual(preferences);
  });

  test("initial lookup in flight exposes no optional defaults or Save", async () => {
    let complete!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => { complete = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).includes("guest-consent") ? response(consent) : pending));
    renderPage();
    await settle();
    expect(screen.queryByRole("checkbox", { name: /WhatsApp messages/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save preferences" })).not.toBeInTheDocument();
    complete(response(preferences));
    await settle();
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled();
  });

  test("save failure keeps the loaded draft editable without replacing it with lookup Retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("guest-consent")) return response(consent);
      return init?.method === "POST" ? response({}, 503) : response(preferences);
    }));
    renderPage();
    await settle();
    screen.getByRole("button", { name: "Save preferences" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Check-in/check-out reminders" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't save");
    expect(screen.getByRole("checkbox", { name: "Check-in/check-out reminders" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Retry loading preferences" })).not.toBeInTheDocument();
  });
});
