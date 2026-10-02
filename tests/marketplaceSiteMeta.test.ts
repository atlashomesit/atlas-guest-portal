import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isMarketplaceRewriteRoute,
  extractListingIdFromPath,
  formatCityNameFromSlug,
  buildMarketplaceMetaValues,
  fetchMarketplaceListingsCached,
  clearMarketplaceListingsCache,
  type MarketplaceListingMetaRow,
} from "../functions/_lib/marketplaceSiteMeta";

describe("marketplaceSiteMeta pure logic (MKT-013)", () => {
  beforeEach(() => {
    clearMarketplaceListingsCache();
  });

  describe("route classification & ID extraction", () => {

    it("recognizes /, /homestays-in-*, and /homes/* as marketplace rewrite routes", () => {
      expect(isMarketplaceRewriteRoute("/")).toBe(true);
      expect(isMarketplaceRewriteRoute("")).toBe(true);
      expect(isMarketplaceRewriteRoute("/homestays-in-hyderabad")).toBe(true);
      expect(isMarketplaceRewriteRoute("/homestays-in-bengaluru")).toBe(true);
      expect(isMarketplaceRewriteRoute("/homestays-in-new-delhi")).toBe(true);
      expect(isMarketplaceRewriteRoute("/homes/cozy-villa/123")).toBe(true);
      expect(isMarketplaceRewriteRoute("/homes/456")).toBe(true);

      // Other routes should not be intercepted for marketplace head rewrite
      expect(isMarketplaceRewriteRoute("/about")).toBe(false);
      expect(isMarketplaceRewriteRoute("/faq")).toBe(false);
      expect(isMarketplaceRewriteRoute("/policies")).toBe(false);
    });

    it("extracts listing ID from various /homes/ paths", () => {
      expect(extractListingIdFromPath("/homes/the-estate-by-grove-co/676")).toBe(676);
      expect(extractListingIdFromPath("/homes/676")).toBe(676);
      expect(extractListingIdFromPath("/homes/676/")).toBe(676);
      expect(extractListingIdFromPath("/homes/my-home/42/details")).toBe(42);
      expect(extractListingIdFromPath("/homes/no-id-here")).toBeNull();
      expect(extractListingIdFromPath("/")).toBeNull();
    });

    it("formats city names from slugs correctly", () => {
      expect(formatCityNameFromSlug("hyderabad")).toBe("Hyderabad");
      expect(formatCityNameFromSlug("bengaluru")).toBe("Bengaluru");
      expect(formatCityNameFromSlug("new-delhi")).toBe("New Delhi");
    });
  });

  describe("buildMarketplaceMetaValues", () => {
    const origin = "https://atlastays.com";

    it("produces unique title, description, self canonical and raster image for homepage /", () => {
      const meta = buildMarketplaceMetaValues("/", "", origin, null);
      expect(meta.title).toBe("Atlastays — Book Homestays Directly with Verified Owners");
      expect(meta.description).toContain("verified vacation homes");
      expect(meta.canonical).toBe("https://atlastays.com/");
      expect(meta.url).toBe("https://atlastays.com/");
      expect(meta.image).toBe("https://atlastays.com/icons/logo512.png");
      expect(meta.image.endsWith(".svg")).toBe(false);
      expect(meta.jsonLd).toBeNull();
    });

    it("produces city-specific title, description, self canonical and raster image for /homestays-in-*", () => {
      const meta = buildMarketplaceMetaValues("/homestays-in-hyderabad", "", origin, null);
      expect(meta.title).toBe("Homestays in Hyderabad — Book Direct with Owners | Atlastays");
      expect(meta.description).toContain("Hyderabad");
      expect(meta.canonical).toBe("https://atlastays.com/homestays-in-hyderabad");
      expect(meta.url).toBe("https://atlastays.com/homestays-in-hyderabad");
      expect(meta.image).toBe("https://atlastays.com/icons/logo512.png");
      expect(meta.image.endsWith(".svg")).toBe(false);
      expect(meta.jsonLd).toBeNull();
    });

    it("produces listing-specific title, raster image, and LodgingBusiness JSON-LD for /homes/*", () => {
      const sampleListing: MarketplaceListingMetaRow = {
        id: 676,
        title: "The Estate by Grove & Co.",
        city: "Hyderabad",
        state: "Telangana",
        description: "Luxury 4-BHK villa with private pool and garden.",
        coverPhotoUrl: "https://imagedelivery.net/abc/hero.jpg",
        tenantSlug: "grove-and-co",
        tenantName: "Grove & Co.",
        pricePerNight: 12000,
        maxGuests: 8,
      };

      const meta = buildMarketplaceMetaValues(
        "/homes/the-estate-by-grove-co/676",
        "?tenant=grove-and-co",
        origin,
        sampleListing,
      );

      expect(meta.title).toBe("The Estate by Grove & Co. in Hyderabad — Atlastays");
      expect(meta.description).toContain("Luxury 4-BHK villa");
      expect(meta.canonical).toBe("https://atlastays.com/homes/the-estate-by-grove-co/676?tenant=grove-and-co");
      expect(meta.image).toBe("https://imagedelivery.net/abc/hero.jpg");
      expect(meta.image.endsWith(".svg")).toBe(false);

      expect(meta.jsonLd).toEqual({
        "@context": "https://schema.org",
        "@type": "LodgingBusiness",
        name: "The Estate by Grove & Co.",
        description: "Luxury 4-BHK villa with private pool and garden.",
        image: "https://imagedelivery.net/abc/hero.jpg",
        url: "https://atlastays.com/homes/the-estate-by-grove-co/676?tenant=grove-and-co",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Hyderabad",
          addressCountry: "IN",
        },
        priceRange: "₹12000",
      });
    });

    it("falls back to raster logo when listing photo is svg or missing", () => {
      const sampleListing: MarketplaceListingMetaRow = {
        id: 99,
        title: "Comfort Cove",
        city: "Guwahati",
        coverPhotoUrl: "/icons/placeholder.svg",
        tenantSlug: "mitali-saikia",
      };

      const meta = buildMarketplaceMetaValues("/homes/comfort-cove/99", "", origin, sampleListing);
      expect(meta.image).toBe("https://atlastays.com/icons/logo512.png");
      expect(meta.image.endsWith(".svg")).toBe(false);
    });

    it("handles not-found listing gracefully", () => {
      const meta = buildMarketplaceMetaValues("/homes/unknown-slug/999", "", origin, null);
      expect(meta.title).toBe("Home not found — Atlastays");
      expect(meta.image).toBe("https://atlastays.com/icons/logo512.png");
      expect(meta.jsonLd).toBeNull();
    });
  });

  describe("fetchMarketplaceListingsCached", () => {
    it("fetches listings from API and returns items", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ id: 1, title: "Listing 1", tenantSlug: "t1" }],
        }),
      });

      const items = await fetchMarketplaceListingsCached("https://api.test.in", mockFetch as unknown as typeof fetch);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(1);
    });

    it("fails open on API error and returns empty array", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const items = await fetchMarketplaceListingsCached("https://api.test.in", mockFetch as unknown as typeof fetch);
      expect(items).toEqual([]);
    });
  });
});
