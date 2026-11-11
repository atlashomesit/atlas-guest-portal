import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import CommunicationPreferences from "./CommunicationPreferences";
import { settle } from "../test/settle";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/tenant/displayBrand", () => ({ getTenantBrandName: () => "Test Brand" }));
vi.mock("@/api/client", () => ({ buildApiUrl: (path: string) => path, getApiHeaders: () => ({}) }));

const preferences = { transactional: true, checkInCheckoutReminders: false, postStayReviewRequest: false, promotionalOffers: false };
const consent = {
  purposes: [
    { purpose: "marketing", label: "Marketing", displayText: "Offers", isGranted: false, canWithdraw: true },
    {
      purpose: "ads_measurement",
      label: "Ads measurement",
      displayText: "I consent to your host sharing a scrambled (hashed) version of my phone number and email address.",
      isGranted: true,
      canWithdraw: true,
    },
  ],
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("TASK-1039907: ads measurement consent can be withdrawn on the preferences page", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => undefined); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  test("the ads_measurement purpose is listed and its Withdraw posts that purpose", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
      String(input).includes("guest-consent") ? json(consent) : json(preferences));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/preferences/test-token"]}><Routes><Route path="/preferences/:guestToken" element={<CommunicationPreferences />} /></Routes></MemoryRouter>);
    await settle();

    expect(screen.getByText("Ads measurement")).toBeInTheDocument();
    expect(screen.queryByTestId("withdraw-consent-marketing")).toBeNull(); // already withdrawn
    fireEvent.click(screen.getByTestId("withdraw-consent-ads_measurement"));
    await settle();

    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(String(writes[0][0])).toContain("/guest-consent/test-token/withdraw");
    expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ purpose: "ads_measurement" });
  });
});
