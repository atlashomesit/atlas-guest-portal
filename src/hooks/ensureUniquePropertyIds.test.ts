import { describe, it, expect } from "vitest";

import { ensureUniquePropertyIds, type TenantPropertyRecord } from "./useTenantListings";

const prop = (id: number | string, listingId: number, name = `Listing ${listingId}`): TenantPropertyRecord => ({
  id,
  listingId,
  property_name: name,
});

describe("ensureUniquePropertyIds", () => {
  it("keeps distinct, non-colliding properties unchanged", () => {
    const input = [prop(501, 10), prop(502, 11), prop(503, 12)];
    const out = ensureUniquePropertyIds(input);
    expect(out.map((p) => p.id)).toEqual([501, 502, 503]);
    expect(out).toHaveLength(3);
  });

  it("falls back to the unique listingId when propertyNumber collides (no listing lost)", () => {
    // Two DISTINCT listings (10 and 11) whose friendly propertyNumber both resolved to 1782.
    const input = [prop(1782, 10), prop(1782, 11)];
    const out = ensureUniquePropertyIds(input);
    expect(out).toHaveLength(2); // both kept — no data loss
    const ids = out.map((p) => p.id);
    expect(new Set(ids).size).toBe(2); // ids are now unique → no duplicate React keys
    expect(ids[0]).toBe(1782); // first keeps the friendly number
    expect(ids[1]).toBe(11); // collider falls back to its unique listingId
  });

  it("drops an exact-duplicate listing (same listingId appears twice)", () => {
    const input = [prop(1782, 10), prop(1782, 10)];
    const out = ensureUniquePropertyIds(input);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1782);
  });

  it("produces all-unique ids for a mixed batch", () => {
    const input = [prop(501, 10), prop(1782, 11), prop(1782, 12), prop(501, 13)];
    const out = ensureUniquePropertyIds(input);
    const ids = out.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // every id unique
    expect(out).toHaveLength(4); // four distinct listings, none dropped
  });
});
