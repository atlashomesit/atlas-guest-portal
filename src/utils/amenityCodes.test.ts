import { describe, expect, it } from "vitest";
import { amenityCodeMatchesCategory, normalizeAmenityToken } from "./amenityCodes";

describe("amenityCodeMatchesCategory (TASK-5195)", () => {
  it("matches AC synonyms exactly", () => {
    expect(amenityCodeMatchesCategory("ac", "ac")).toBe(true);
    expect(amenityCodeMatchesCategory("air_conditioning", "ac")).toBe(true);
    expect(amenityCodeMatchesCategory("air-conditioning", "ac")).toBe(true);
    expect(amenityCodeMatchesCategory("Air Conditioner", "ac")).toBe(true);
  });

  it("does not match terrace or washing_machine as AC", () => {
    expect(amenityCodeMatchesCategory("terrace", "ac")).toBe(false);
    expect(amenityCodeMatchesCategory("washing_machine", "ac")).toBe(false);
    expect(amenityCodeMatchesCategory("vacuum", "ac")).toBe(false);
  });

  it("still matches balcony via terrace synonym", () => {
    expect(amenityCodeMatchesCategory("terrace", "balcony")).toBe(true);
    expect(amenityCodeMatchesCategory("balcony", "balcony")).toBe(true);
  });

  it("normalizeAmenityToken strips separators", () => {
    expect(normalizeAmenityToken("air_conditioning")).toBe("airconditioning");
    expect(normalizeAmenityToken(" air-con ")).toBe("aircon");
  });
});
