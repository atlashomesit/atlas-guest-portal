import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeConfig, setRuntimeConfig } from "@/runtime-config";
import {
  fetchListingById,
  fetchListingPhotos,
  fetchPropertyListingPhotos,
  fetchPublicListings,
  fetchSimilarListings,
  invalidatePublicListingsCache,
  listingPhotosToSortedUrls,
  normalizeListingPhotoResponse,
  parseListingPhotosResponse,
  PUBLIC_LISTINGS_TTL_MS,
} from "./listingClient";
import { _resetDedupedJsonFetchForTests } from "./dedupedJsonFetch";

const API_BASE = "https://api.example.com";

const fetchMock = vi.fn();

describe("listingClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setRuntimeConfig({ apiBaseUrl: API_BASE });
    _resetDedupedJsonFetchForTests();
  });

  afterEach(() => {
    _resetDedupedJsonFetchForTests();
    clearRuntimeConfig();
    vi.unstubAllGlobals();
  });

  it("fetchPublicListings caches within the TTL and refetches after it expires", async () => {
    vi.useFakeTimers();
    try {
      invalidatePublicListingsCache();
      fetchMock.mockResolvedValue({ ok: true, json: async () => [] });

      await fetchPublicListings();
      await fetchPublicListings();
      expect(fetchMock).toHaveBeenCalledTimes(1); // second call served from cache

      vi.advanceTimersByTime(PUBLIC_LISTINGS_TTL_MS + 1);
      await fetchPublicListings();
      expect(fetchMock).toHaveBeenCalledTimes(2); // TTL expired -> network refetch
    } finally {
      invalidatePublicListingsCache();
      vi.useRealTimers();
    }
  });

  it("TASK-7824: concurrent fetchListingById(2) share one network GET", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 2, name: "Atlas102", propertyId: 1 }),
    });

    const [a, b] = await Promise.all([fetchListingById(2), fetchListingById(2)]);

    expect(a).toMatchObject({ id: 2, name: "Atlas102" });
    expect(b).toMatchObject({ id: 2, name: "Atlas102" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("TASK-7824: fetchSimilarListings hits /listings/{id}/similar", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 9, name: "Near" }],
    });

    const rows = await fetchSimilarListings(2, 6);
    expect(rows).toEqual([{ id: 9, name: "Near" }]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_BASE}/listings/2/similar?limit=6`);
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

  it("fetchListingPhotos(9) calls GET /listings/9/photos (property id)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        "https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg",
      ],
    });

    const urls = await fetchListingPhotos(9);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/listings/9/photos`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(urls).toEqual([
      "https://atlashomestorage.blob.core.windows.net/listing-images/9/cover.jpg",
    ]);
  });

  it("fetchListingPhotos with listingId filters rows by listingId", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { listingId: 1, url: "https://x/a.jpg", sortOrder: 2 },
        { listingId: 2, url: "https://x/b.jpg", sortOrder: 1 },
        { listingId: 2, url: "https://x/c.jpg", sortOrder: 2 },
      ],
    });

    const urls = await fetchListingPhotos(100, undefined, { listingId: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/listings/100/photos`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(urls).toEqual(["https://x/b.jpg", "https://x/c.jpg"]);
  });

  it("fetchListingPhotos returns [] on 404", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchListingPhotos(99)).resolves.toEqual([]);
  });

  it("fetchPropertyListingPhotos returns typed rows from DTO array", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 10,
          listingId: 2,
          url: "https://x/b.jpg",
          originalFileName: "b.jpg",
          sortOrder: 1,
          caption: null,
          isCover: true,
        },
        {
          id: 11,
          listingId: 1,
          url: "https://x/a.jpg",
          originalFileName: "a.jpg",
          sortOrder: 1,
          caption: null,
          isCover: true,
        },
      ],
    });

    const rows = await fetchPropertyListingPhotos(55);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/listings/55/photos`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(rows.map((r) => r.listingId)).toEqual([1, 2]);
    expect(rows[0].url).toBe("https://x/a.jpg");
  });
});

describe("parseListingPhotosResponse / listingPhotosToSortedUrls", () => {
  it("parseListingPhotosResponse maps API-shaped rows", () => {
    const rows = parseListingPhotosResponse([
      { id: 1, listingId: 9, url: "https://u/1", originalFileName: "a.jpg", sortOrder: 2, caption: "x", isCover: false },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 1, listingId: 9, url: "https://u/1", sortOrder: 2 });
  });

  it("listingPhotosToSortedUrls filters by listingId", () => {
    const urls = listingPhotosToSortedUrls(
      [
        { id: 1, listingId: 2, url: "https://b", originalFileName: null, sortOrder: 2, caption: null, isCover: false },
        { id: 2, listingId: 2, url: "https://a", originalFileName: null, sortOrder: 1, caption: null, isCover: true },
      ],
      2,
    );
    expect(urls).toEqual(["https://a", "https://b"]);
  });
});

describe("normalizeListingPhotoResponse", () => {
  it("accepts string[]", () => {
    expect(normalizeListingPhotoResponse(["a", " b "])).toEqual(["a", "b"]);
  });

  it("accepts { items: [{ url }] }", () => {
    expect(
      normalizeListingPhotoResponse({
        items: [{ url: "https://example.com/1.jpg" }, { photoUrl: "https://example.com/2.jpg" }],
      }),
    ).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
  });
});
