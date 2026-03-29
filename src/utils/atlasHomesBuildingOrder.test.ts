import { describe, expect, it } from "vitest";
import { compareAtlasHomesBuildingOrder } from "./atlasHomesBuildingOrder";

describe("compareAtlasHomesBuildingOrder", () => {
  it("orders penthouse then floors 3, 2, 1 with ascending unit within floor", () => {
    const ids = [102, 501, 201, 301, 101, 302, 202];
    const sorted = [...ids].sort(compareAtlasHomesBuildingOrder);
    expect(sorted).toEqual([501, 301, 302, 201, 202, 101, 102]);
  });
});
