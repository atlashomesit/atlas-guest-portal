import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearRuntimeConfig, setRuntimeConfig } from "@/runtime-config";
import { submitCallbackRequest } from "./callbackService";

const BACKLOG_KEY = "callback_leads_backlog";

const basePayload = {
  phone: "+919876543210",
  route: "/property_details/oak-suite",
  unitCode: "oak-suite",
  source: "support_widget",
};

beforeEach(() => {
  setRuntimeConfig({ apiBaseUrl: "https://api.test" });
  window.localStorage.clear();
});

afterEach(() => {
  clearRuntimeConfig();
  vi.unstubAllGlobals();
});

/**
 * TASK-101600: submitCallbackRequest used to be a client-only mock (trackEvent + sleep(300) +
 * return { success: true }) — it never made a network call, so no lead ever reached the host.
 * These assertions fail against that mock (no fetch call is ever made) and pass once the service
 * actually posts to POST /api/leads/callback and falls back to localStorage on failure, exactly
 * as atlas-guest-portal/docs/callback-leads.md specifies.
 */
describe("submitCallbackRequest — TASK-101600 real network call + localStorage fallback", () => {
  it("POSTs to /api/leads/callback and resolves on a 2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, leadId: "cb_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitCallbackRequest(basePayload);

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/leads/callback");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.phone).toBe(basePayload.phone);
    expect(body.route).toBe(basePayload.route);
    expect(body.unitCode).toBe(basePayload.unitCode);

    // Success must never populate the offline backlog.
    expect(window.localStorage.getItem(BACKLOG_KEY)).toBeNull();
  });

  it("falls back to the callback_leads_backlog localStorage key and rejects on a network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitCallbackRequest(basePayload)).rejects.toThrow();

    const raw = window.localStorage.getItem(BACKLOG_KEY);
    expect(raw).not.toBeNull();
    const backlog = JSON.parse(raw as string);
    expect(Array.isArray(backlog)).toBe(true);
    expect(backlog).toHaveLength(1);
    expect(backlog[0].phone).toBe(basePayload.phone);
  });

  it("falls back to the backlog and rejects on a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitCallbackRequest(basePayload)).rejects.toThrow();

    const backlog = JSON.parse(window.localStorage.getItem(BACKLOG_KEY) as string);
    expect(backlog).toHaveLength(1);
    expect(backlog[0].phone).toBe(basePayload.phone);
  });

  it("caps the backlog at 25 entries, dropping the oldest first", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 27; i += 1) {
      await expect(
        submitCallbackRequest({ ...basePayload, phone: `+9198765${String(i).padStart(5, "0")}` }),
      ).rejects.toThrow();
    }

    const backlog = JSON.parse(window.localStorage.getItem(BACKLOG_KEY) as string);
    expect(backlog).toHaveLength(25);
    // Oldest two (index 0, 1) were dropped; the surviving oldest is index 2.
    expect(backlog[0].phone).toBe("+919876500002");
    expect(backlog[24].phone).toBe("+919876500026");
  });
});
