import { describe, expect, it } from "vitest";
import { buildHomepageJsonLd } from "./homepageJsonLd";

describe("buildHomepageJsonLd (TASK-5200)", () => {
  const base = {
    schemaBrandName: "Atlas Homestays",
    canonicalUrl: "https://guest.example.com/",
    contactEmail: "hello@example.com",
    hideAtlasBranding: false,
    faqHighlights: [{ question: "Check-in?", answer: "From 2 PM." }],
  };

  it("omits makesOffer and hardcoded address when no listing address", () => {
    const blocks = buildHomepageJsonLd(base);
    const lodging = blocks.find((b) => b["@type"] && Array.isArray(b["@type"])) as Record<
      string,
      unknown
    >;

    expect(lodging).toBeDefined();
    expect(lodging.address).toBeUndefined();
    expect(lodging.makesOffer).toBeUndefined();
  });

  it("includes listing-provided address only when present", () => {
    const blocks = buildHomepageJsonLd({
      ...base,
      listingAddress: " 501 Penthouse, KPHB 7th Phase ",
    });
    const lodging = blocks.find((b) => b["@type"] && Array.isArray(b["@type"])) as Record<
      string,
      unknown
    >;
    const address = lodging.address as Record<string, unknown>;

    expect(address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "501 Penthouse, KPHB 7th Phase",
      addressCountry: "IN",
    });
    expect(lodging.makesOffer).toBeUndefined();
  });

  it("omits lodgingBusiness on white-label tenants", () => {
    const blocks = buildHomepageJsonLd({
      ...base,
      hideAtlasBranding: true,
      listingAddress: "Some address",
    });

    expect(blocks).toHaveLength(2);
    expect(blocks.some((b) => b["@type"] === "FAQPage")).toBe(true);
    expect(blocks.some((b) => Array.isArray(b["@type"]))).toBe(false);
  });
});
