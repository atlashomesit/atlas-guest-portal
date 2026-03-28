import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeConfig, setRuntimeConfig } from "@/runtime-config";
import { fetchListingById } from "./listingClient";

const API_BASE = "https://api.example.com";

const fetchMock = vi.fn();

describe("listingClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setRuntimeConfig({ apiBaseUrl: API_BASE });
  });

  afterEach(() => {
    clearRuntimeConfig();
    vi.unstubAllGlobals();
  });

  it("fetchListingById(2) calls /listings/2", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 2, name: "Atlas102", propertyId: 1 }),
    });

    await fetchListingById(2);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/listings/2`,
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it("TRAP FIXTURE: id=2 name=Atlas102 must call /listings/2 not /listings/102", async () => {
    const listing = { id: 2, name: "Atlas102", propertyId: 1 };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => listing,
    });

    await fetchListingById(listing.id);

    const calledUrl = fetchMock.mock.calls[0]?.[0];
    expect(calledUrl).toBe(`${API_BASE}/listings/2`);
    expect(calledUrl).not.toContain("/listings/102");
  });
});
