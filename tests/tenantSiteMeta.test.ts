import { isRewriteEligibleHost, buildMetaRewriteValues, type TenantSiteMeta } from "../functions/_lib/tenantSiteMeta";

describe("isRewriteEligibleHost (TASK-4905 / ADR-0018 amendment)", () => {
  it("excludes the marketplace apex family", () => {
    expect(isRewriteEligibleHost("atlastays.com")).toBe(false);
    expect(isRewriteEligibleHost("www.atlastays.com")).toBe(false);
    expect(isRewriteEligibleHost("dev.atlastays.com")).toBe(false);
  });

  it("excludes the Atlas direct-booking domain family (corrected 2026-07-17 scope)", () => {
    expect(isRewriteEligibleHost("atlashomestays.com")).toBe(false);
    expect(isRewriteEligibleHost("www.atlashomestays.com")).toBe(false);
    expect(isRewriteEligibleHost("atlashomes.in")).toBe(false);
    expect(isRewriteEligibleHost("www.atlashomes.in")).toBe(false);
    expect(isRewriteEligibleHost("dev.atlashomestays.com")).toBe(false);
    expect(isRewriteEligibleHost("localhost")).toBe(false);
    expect(isRewriteEligibleHost("127.0.0.1")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isRewriteEligibleHost("ATLASTAYS.COM")).toBe(false);
    expect(isRewriteEligibleHost("Www.AtlasHomestays.com")).toBe(false);
  });

  it("is eligible for a tenant subdomain", () => {
    expect(isRewriteEligibleHost("gaurav.atlastays.com")).toBe(true);
  });

  it("is eligible for a verified custom domain", () => {
    expect(isRewriteEligibleHost("staybycity.example.com")).toBe(true);
    expect(isRewriteEligibleHost("www.gauravsguesthouse.com")).toBe(true);
  });

  it("is not eligible for null/undefined/empty host (malformed input)", () => {
    expect(isRewriteEligibleHost(null)).toBe(false);
    expect(isRewriteEligibleHost(undefined)).toBe(false);
    expect(isRewriteEligibleHost("")).toBe(false);
    expect(isRewriteEligibleHost("   ")).toBe(false);
  });
});

describe("buildMetaRewriteValues (TASK-4905 / ADR-0018 amendment)", () => {
  const fullMeta: TenantSiteMeta = {
    tenantSlug: "gaurav",
    propertyName: "Gaurav's Lake View Villa",
    description: "Stay lakeside at Gaurav's Lake View Villa.",
    photoUrl: "https://cdn.example.com/gaurav-cover.jpg",
    canonicalUrl: "https://gauravsguesthouse.com/",
  };

  it("uses every field verbatim when the payload is fully populated (root path)", () => {
    const values = buildMetaRewriteValues(fullMeta, "https://gauravsguesthouse.com/");

    expect(values.title).toBe("Gaurav's Lake View Villa");
    expect(values.description).toBe("Stay lakeside at Gaurav's Lake View Villa.");
    expect(values.image).toBe("https://cdn.example.com/gaurav-cover.jpg");
    expect(values.url).toBe("https://gauravsguesthouse.com/");
    expect(values.canonical).toBe("https://gauravsguesthouse.com/");
  });

  // TASK-7430: non-root pages must keep a path-correct canonical (not collapse to site root).
  it("TASK-7430: preserves request path in canonical/og:url for non-root pages", () => {
    const values = buildMetaRewriteValues(fullMeta, "https://gauravsguesthouse.com/homes/1");

    expect(values.canonical).toBe("https://gauravsguesthouse.com/homes/1");
    expect(values.url).toBe("https://gauravsguesthouse.com/homes/1");
  });

  it("falls back to a generated description when description is missing", () => {
    const values = buildMetaRewriteValues(
      { ...fullMeta, description: null },
      "https://gauravsguesthouse.com/",
    );

    expect(values.description).toBe(
      "Book Gaurav's Lake View Villa directly. Verified property, zero booking fees, instant confirmation.",
    );
  });

  it("falls back to a generated description when description is whitespace-only (malformed)", () => {
    const values = buildMetaRewriteValues({ ...fullMeta, description: "   " }, "https://x.com/");
    expect(values.description).toContain("Gaurav's Lake View Villa");
  });

  it("falls back to the OG placeholder image when photoUrl is missing", () => {
    const values = buildMetaRewriteValues({ ...fullMeta, photoUrl: null }, "https://x.com/");
    expect(values.image).toBe("/og-image.svg");
  });

  it("falls back to the OG placeholder image when photoUrl is whitespace-only (malformed)", () => {
    const values = buildMetaRewriteValues({ ...fullMeta, photoUrl: "   " }, "https://x.com/");
    expect(values.image).toBe("/og-image.svg");
  });

  it("falls back to tenantSlug when propertyName is empty (malformed)", () => {
    const values = buildMetaRewriteValues({ ...fullMeta, propertyName: "" }, "https://x.com/");
    expect(values.title).toBe("gaurav");
  });

  it("falls back to a generic brand string when both propertyName and tenantSlug are empty", () => {
    const values = buildMetaRewriteValues(
      { ...fullMeta, propertyName: "", tenantSlug: "" },
      "https://x.com/",
    );
    expect(values.title).toBe("Atlastays");
  });

  it("falls back to the request URL when canonicalUrl is missing (malformed)", () => {
    const values = buildMetaRewriteValues(
      { ...fullMeta, canonicalUrl: "" },
      "https://gauravsguesthouse.com/homes/1",
    );
    expect(values.canonical).toBe("https://gauravsguesthouse.com/homes/1");
    expect(values.url).toBe("https://gauravsguesthouse.com/homes/1");
  });

  it("never produces an empty title/description/image/canonical even for a fully-blank payload", () => {
    const blank: TenantSiteMeta = {
      tenantSlug: "",
      propertyName: "",
      description: "",
      photoUrl: "",
      canonicalUrl: "",
    };
    const values = buildMetaRewriteValues(blank, "https://x.com/");

    expect(values.title.length).toBeGreaterThan(0);
    expect(values.description.length).toBeGreaterThan(0);
    expect(values.image.length).toBeGreaterThan(0);
    expect(values.canonical.length).toBeGreaterThan(0);
  });
});
