/**
 * CHN-012 (guest half): `GET /api/public/chain/sister-availability` client. Read-only suggestion: any failure resolves null
 * so the cards simply do not render (never a wrong claim).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: (tenant?: string | null) => (tenant ? { "X-Tenant-Slug": tenant } : {}),
}));

import { fetchSisterAvailability, parseSisterSpillover } from "./sisterAvailabilityClient";

const API_BODY = {
  sourcePropertyId: 3,
  sourcePropertyName: "Atlas Homes Madikeri",
  sourceSoldOut: true,
  checkIn: "2026-11-06",
  checkOut: "2026-11-08",
  nights: 2,
  guests: 2,
  properties: [
    {
      propertyId: 8,
      propertyName: "Atlas Homes Coorg",
      city: "Madikeri",
      state: "Karnataka",
      distanceKm: 12.4,
      listings: [
        { listingId: 81, listingName: "Garden Suite", maxGuests: 3, coverPhotoUrl: null, currency: "INR", totalAmount: 11800.5, averagePerNight: 5900.25 },
        { listingId: 0, listingName: "Bad id", maxGuests: 2, currency: "INR", totalAmount: 1, averagePerNight: 1 },
      ],
    },
    { propertyId: 9, propertyName: "No units", listings: [] },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSisterSpillover", () => {
  it("maps the API shape and keeps the amounts exactly as returned", () => {
    const parsed = parseSisterSpillover(API_BODY)!;
    expect(parsed.sourceSoldOut).toBe(true);
    expect(parsed.properties).toHaveLength(1); // the property with no usable unit is dropped
    const card = parsed.properties[0];
    expect(card).toMatchObject({ propertyId: 8, propertyName: "Atlas Homes Coorg", city: "Madikeri", state: "Karnataka", distanceKm: 12.4 });
    expect(card.listings).toHaveLength(1); // the unit without a real id is dropped
    expect(card.listings[0]).toMatchObject({ listingId: 81, listingName: "Garden Suite", maxGuests: 3, currency: "INR", totalAmount: 11800.5, averagePerNight: 5900.25 });
  });

  it("is null for anything that is not the response shape", () => {
    expect(parseSisterSpillover(null)).toBeNull();
    expect(parseSisterSpillover("nope")).toBeNull();
    expect(parseSisterSpillover({ properties: "x" })).toBeNull();
  });

  it("treats a missing flag as not sold out (fail-safe: no cards)", () => {
    const parsed = parseSisterSpillover({ ...API_BODY, sourceSoldOut: undefined })!;
    expect(parsed.sourceSoldOut).toBe(false);
  });
});

describe("fetchSisterAvailability", () => {
  it("asks for the property, dates and guest count, carrying the tenant header", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(API_BODY));
    vi.stubGlobal("fetch", fetchMock);
    const ac = new AbortController();

    const result = await fetchSisterAvailability(3, "2026-11-06", "2026-11-08", 2, "coorg-resort", ac.signal);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toBe("/api/public/chain/sister-availability");
    expect(parsedUrl.searchParams.get("propertyId")).toBe("3");
    expect(parsedUrl.searchParams.get("checkIn")).toBe("2026-11-06");
    expect(parsedUrl.searchParams.get("checkOut")).toBe("2026-11-08");
    expect(parsedUrl.searchParams.get("guests")).toBe("2");
    expect(init.headers).toEqual({ "X-Tenant-Slug": "coorg-resort" });
    expect(init.signal).toBe(ac.signal);
    expect(result?.properties[0].listings[0].listingId).toBe(81);
  });

  it("resolves null on a non-OK answer, a network error or junk JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "STAY_TOO_LONG" }, 400)));
    expect(await fetchSisterAvailability(3, "2026-11-06", "2026-11-08", 2)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await fetchSisterAvailability(3, "2026-11-06", "2026-11-08", 2)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    expect(await fetchSisterAvailability(3, "2026-11-06", "2026-11-08", 2)).toBeNull();
  });
});
