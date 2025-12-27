import { afterEach, describe, expect, it } from "vitest";

import { calculateNightlyPrice, inferUnitType } from "./pricing";

const resetEnv = () => {
  delete (process as any).env.VITE_GLOBAL_DISCOUNT_PERCENT;
  delete (process as any).env.VITE_DATE_MULTIPLIERS_JSON;
};

afterEach(() => {
  resetEnv();
});

describe("calculateNightlyPrice", () => {
  it("applies the default discount for 1BHK units", () => {
    const result = calculateNightlyPrice({
      unitType: "1bhk",
      checkInDate: "2024-12-02",
      guests: 2,
    });

    expect(result.finalNightlyPrice).toBe(2905);
    expect(result.appliedDiscountPercent).toBe(17);
    expect(result.discountAmount).toBeCloseTo(595);
  });

  it("applies the default discount for penthouse units", () => {
    const result = calculateNightlyPrice({
      unitType: "penthouse",
      checkInDate: "2024-11-18",
      guests: 2,
    });

    expect(result.finalNightlyPrice).toBe(4980);
    expect(result.appliedDiscountPercent).toBe(17);
  });

  it("doubles the nightly rate for stays on Dec 31", () => {
    const result = calculateNightlyPrice({
      unitType: "1bhk",
      checkInDate: "2024-12-31",
      guests: 2,
    });

    expect(result.isNewYearsEve).toBe(true);
    expect(result.dateMultiplier).toBe(2);
    expect(result.finalNightlyPrice).toBe(5810);
  });

  it("adds configured extra guest fees when over the included guest count", () => {
    const result = calculateNightlyPrice({
      unitType: "1bhk",
      checkInDate: "2024-12-15",
      guests: 4,
    });

    expect(result.extraGuestFee).toBe(1000);
    expect(result.finalNightlyPrice).toBe(3905);
  });

  it("respects environment override for discounts", () => {
    (process as any).env.VITE_GLOBAL_DISCOUNT_PERCENT = "10";

    const result = calculateNightlyPrice({
      unitType: "1bhk",
      checkInDate: "2024-10-10",
      guests: 2,
    });

    expect(result.appliedDiscountPercent).toBe(10);
    expect(result.finalNightlyPrice).toBe(3150);
  });

  it("respects environment override for date multipliers", () => {
    (process as any).env.VITE_DATE_MULTIPLIERS_JSON = JSON.stringify({ "12-31": 3, "01-01": 1.5 });

    const result = calculateNightlyPrice({
      unitType: "penthouse",
      checkInDate: "2024-12-31",
      guests: 2,
    });

    expect(result.dateMultiplier).toBe(3);
    expect(result.finalNightlyPrice).toBe(14940);
  });
});

describe("inferUnitType", () => {
  it("returns the metadata unit type when provided", () => {
    expect(
      inferUnitType({
        property_name: "Atlas Homes Room 101",
        metadata: { unitType: "1bhk" },
      }),
    ).toBe("1bhk");
  });

  it("supports snake_case metadata keys", () => {
    expect(
      inferUnitType({
        name: "Atlas Penthouse 501",
        property_metadata: { unit_type: "penthouse" },
      }),
    ).toBe("penthouse");
  });

  it("falls back to property name when metadata is missing", () => {
    expect(inferUnitType({ name: "Skyline Penthouse" })).toBe("penthouse");
  });

  it("defaults to 1bhk when no hints are present", () => {
    expect(inferUnitType({ id: "999", name: "Unknown" })).toBe("1bhk");
  });
});
