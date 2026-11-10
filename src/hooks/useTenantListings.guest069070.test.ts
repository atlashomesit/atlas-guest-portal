/**
 * GUEST-070: the listing's direct minimum stay must survive mapDtoToProperty so the booking widget knows it from the first render (it was dropped here, so a link with
 * fewer nights quoted a price and left Reserve enabled). GUEST-069: the host's rules and map link survive the same mapping.
 */
import { describe, expect, it } from "vitest";
import { mapDtoToProperty } from "./useTenantListings";
import type { PublicListing } from "@/api/listingClient";

const base: PublicListing = { id: 6, name: "Room 2", propertyName: "Home", maxGuests: 3, photoUrls: [], propertyAddress: null, seoDescription: null, metaDescription: null };

describe("mapDtoToProperty carries minStay and the host's rules (GUEST-070, GUEST-069)", () => {
  it("keeps a minimum above one night", () => {
    expect(mapDtoToProperty({ ...base, minStay: 3 }).minStay).toBe(3);
  });
  it("no minimum (null, 1 or absent) maps to null", () => {
    expect(mapDtoToProperty({ ...base, minStay: null }).minStay).toBeNull();
    expect(mapDtoToProperty({ ...base, minStay: 1 }).minStay).toBeNull();
    expect(mapDtoToProperty(base).minStay).toBeNull();
  });
  it("carries the rules text, structured rules, PDF and map link", () => {
    const p = mapDtoToProperty({
      ...base,
      houseRulesText: "Shoes off.",
      houseRulesStructured: '{"smoking":false}',
      houseRulesPdfUrl: "https://files.example.com/r.pdf",
      googleMapsUrl: "https://maps.app.goo.gl/x",
    });
    expect(p.houseRulesText).toBe("Shoes off.");
    expect(p.houseRulesStructured).toBe('{"smoking":false}');
    expect(p.houseRulesPdfUrl).toBe("https://files.example.com/r.pdf");
    expect(p.googleMapsUrl).toBe("https://maps.app.goo.gl/x");
  });
  it("absent fields map to null", () => {
    const p = mapDtoToProperty(base);
    expect(p.houseRulesText).toBeNull();
    expect(p.googleMapsUrl).toBeNull();
  });
});
