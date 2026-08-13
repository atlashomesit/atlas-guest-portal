import { describe, expect, it } from "vitest";
import {
  buildGuestImageSrcSet,
  filterGuestImageUrls,
  GUEST_IMAGE_PROXY_PATH,
  isBlockedGuestImageUrl,
  sanitizeGuestImageUrl,
  toTransformedGuestImageUrl,
} from "./guestImageUrl";
import {
  clampTransformWidth,
  DEFAULT_TRANSFORM_WIDTH,
  isAllowedBlobImageUrl,
  MAX_TRANSFORM_WIDTH,
  MIN_TRANSFORM_WIDTH,
} from "../../functions/_lib/guestImageProxy";

const BLOB =
  "https://atlashomestorage.blob.core.windows.net/atlas-media/atlas/5/198a8a02-5095-4ced-b78f-9c4077ab12fc.jpg";

describe("guestImageUrl (TASK-7821)", () => {
  it("allowlists the canonical blob host and blocks other Azure accounts", () => {
    expect(isBlockedGuestImageUrl(BLOB)).toBe(false);
    expect(isBlockedGuestImageUrl("https://other.blob.core.windows.net/x.jpg")).toBe(true);
    expect(sanitizeGuestImageUrl(BLOB)).toBe(BLOB);
    expect(sanitizeGuestImageUrl("https://other.blob.core.windows.net/x.jpg")).toBeUndefined();
  });

  it("rewrites blob URLs through /img with a width param — never ?w= on the blob host", () => {
    const transformed = toTransformedGuestImageUrl(BLOB, 480);
    expect(transformed).toBeDefined();
    expect(transformed!.startsWith(`${GUEST_IMAGE_PROXY_PATH}?`)).toBe(true);
    expect(transformed).toContain("w=480");
    expect(transformed).toContain(encodeURIComponent(BLOB).slice(0, 40));
    expect(transformed).not.toContain("blob.core.windows.net/?");
    expect(transformed).not.toContain("auto=format");
  });

  it("leaves non-blob URLs untouched after sanitize", () => {
    const cdn = "https://images.example.com/photo.jpg";
    expect(toTransformedGuestImageUrl(cdn, 480)).toBe(cdn);
  });

  it("builds a 480/768/1200 srcset that all go through /img", () => {
    const srcset = buildGuestImageSrcSet(BLOB);
    expect(srcset).toContain("480w");
    expect(srcset).toContain("768w");
    expect(srcset).toContain("1200w");
    for (const part of srcset!.split(",")) {
      const src = part.trim().split(/\s+/)[0];
      expect(src.startsWith(`${GUEST_IMAGE_PROXY_PATH}?`)).toBe(true);
      expect(src.startsWith("https://")).toBe(false);
    }
  });

  it("filterGuestImageUrls drops blocked hosts", () => {
    expect(filterGuestImageUrls([BLOB, "https://evil.blob.core.windows.net/x.jpg"])).toEqual([
      BLOB,
    ]);
  });
});

describe("guestImageProxy helpers (TASK-7821)", () => {
  it("allows only the canonical https blob host", () => {
    expect(isAllowedBlobImageUrl(BLOB)).toBe(true);
    expect(isAllowedBlobImageUrl("https://evil.blob.core.windows.net/x.jpg")).toBe(false);
    expect(isAllowedBlobImageUrl("http://atlashomestorage.blob.core.windows.net/a.jpg")).toBe(
      false,
    );
  });

  it("clamps transform widths", () => {
    expect(clampTransformWidth(null)).toBe(DEFAULT_TRANSFORM_WIDTH);
    expect(clampTransformWidth("40")).toBe(MIN_TRANSFORM_WIDTH);
    expect(clampTransformWidth("99999")).toBe(MAX_TRANSFORM_WIDTH);
    expect(clampTransformWidth("480")).toBe(480);
  });
});
