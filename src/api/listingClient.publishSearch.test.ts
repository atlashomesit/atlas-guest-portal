import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearRuntimeConfig, setRuntimeConfig } from "@/runtime-config";
import {
  fetchPublicListings,
  invalidatePublicListingsCache,
} from "./listingClient";

const API_BASE = "https://api.example.com";
const fetchMock = vi.fn();

function listingsPayload(ids: number[]) {
  return ids.map((id) => ({
    id,
    propertyId: 10,
    propertyName: "Test Property",
    name: `Unit ${id}`,
    maxGuests: 2,
    baseNightlyRate: 1000,
    propertyAddress: "Goa",
  }));
}

describe("TASK-8296 publish then search freshness", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setRuntimeConfig({ apiBaseUrl: API_BASE });
    invalidatePublicListingsCache();
  });
  afterEach(() => {
    invalidatePublicListingsCache();
    clearRuntimeConfig();
    vi.unstubAllGlobals();
  });

  it("RED-before: second fetch within TTL without bypass returns stale (publish invisible)", async () => {
    // First load: server has 1 listing
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listingsPayload([1]) });
    const first = await fetchPublicListings();
    expect(first.map((r) => r.id)).toEqual([1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Host publishes listing 99 — but without bypass search still serves stale cache
    const stale = await fetchPublicListings();
    expect(stale.map((r) => r.id)).toEqual([1]); // bug: 99 invisible
    expect(fetchMock).toHaveBeenCalledTimes(1); // no network hit due to TTL
  });

  it("GREEN-after: bypassCache forces network fetch so freshly published listing appears within 5s", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listingsPayload([1]) });
    await fetchPublicListings();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listingsPayload([1, 99]) });
    const fresh = await fetchPublicListings(undefined, { bypassCache: true });
    expect(fresh.map((r) => r.id)).toEqual([1, 99]); // visible immediately
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("publish returns immediately: bypass fetch resolves without artificial 5s delay", async () => {
    invalidatePublicListingsCache();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listingsPayload([1]) });
    await fetchPublicListings();

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listingsPayload([1, 2]) });
    const start = Date.now();
    const fresh = await fetchPublicListings(undefined, { bypassCache: true });
    const elapsed = Date.now() - start;
    expect(fresh.map((r) => r.id)).toEqual([1, 2]);
    expect(elapsed).toBeLessThan(1000);
  });

  it("SearchPage contract: bypassCache updates shared cache so later TTL reads are fresh", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listingsPayload([1]) });
    await fetchPublicListings();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => listingsPayload([1, 99]) });
    const bypassed = await fetchPublicListings(undefined, { bypassCache: true });
    expect(bypassed.map((r) => r.id)).toEqual([1, 99]);

    // Subsequent normal TTL read should now see the fresh data without another network hit
    const cached = await fetchPublicListings();
    expect(cached.map((r) => r.id)).toEqual([1, 99]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
