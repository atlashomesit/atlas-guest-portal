import { describe, expect, it, vi } from "vitest";
import { buildHomeDetailsLodgingJsonLd } from "./homeDetailsJsonLd";

vi.mock("@/config/siteOrigin", () => ({
  getPublicSiteOrigin: () => "https://guest.example.com",
}));

describe("buildHomeDetailsLodgingJsonLd", () => {
  it("includes canonical url and aggregateRating when reviews exist", () => {
    const schema = buildHomeDetailsLodgingJsonLd({
      roomTitle: "Garden Suite",
      roomHref: "/homes/101",
      tagline: "Quiet corner room",
      highlights: ["Wi‑Fi", "Parking"],
      imageUrls: ["https://cdn.example/1.jpg"],
      apiListing: {
        propertyAddress: "12 MG Road",
        latitude: 17.4,
        longitude: 78.5,
        baseNightlyRate: 3200,
      },
      tenantBrandName: "Star Guest House",
      hideAtlasBranding: true,
      reviews: { totalCount: 4, averageRating: 4.5 },
    });

    expect(schema["@type"]).toBe("LodgingBusiness");
    expect(schema.url).toBe("https://guest.example.com/homes/101");
    expect(schema.name).toBe("Garden Suite");
    const ar = schema.aggregateRating as Record<string, unknown>;
    expect(ar["@type"]).toBe("AggregateRating");
    expect(ar.ratingValue).toBe(4.5);
    expect(ar.reviewCount).toBe(4);
    const prov = schema.provider as Record<string, unknown>;
    expect(prov["@type"]).toBe("Organization");
    expect(prov.name).toBe("Star Guest House");
  });

  it("omits aggregateRating and provider for marketplace default", () => {
    const schema = buildHomeDetailsLodgingJsonLd({
      roomTitle: "Room A",
      roomHref: "/homes/2",
      highlights: [],
      imageUrls: [],
      tenantBrandName: "Atlas Homestays",
      hideAtlasBranding: false,
      reviews: null,
    });
    expect(schema.aggregateRating).toBeUndefined();
    expect(schema.provider).toBeUndefined();
  });
});
