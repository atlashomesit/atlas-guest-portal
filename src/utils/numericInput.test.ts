import { describe, it, expect } from "vitest";
import { toEditableInt, clampMin } from "./numericInput";

describe("toEditableInt", () => {
  it("allows an empty field while the user is mid-edit (the mobile backspace fix)", () => {
    expect(toEditableInt("")).toBe("");
  });

  it("parses normal integers, including two digits", () => {
    expect(toEditableInt("3")).toBe(3);
    expect(toEditableInt("12")).toBe(12);
  });

  it("treats unparseable input as empty rather than NaN", () => {
    expect(toEditableInt("abc")).toBe("");
    expect(toEditableInt("-")).toBe("");
  });
});

describe("clampMin", () => {
  it("clamps an empty value up to the floor on blur/submit", () => {
    expect(clampMin("", 1)).toBe(1);
    expect(clampMin("", 0)).toBe(0);
  });

  it("clamps below-floor numbers up to the floor", () => {
    expect(clampMin(0, 1)).toBe(1);
    expect(clampMin(-5, 1)).toBe(1);
  });

  it("passes valid values through unchanged", () => {
    expect(clampMin(3, 1)).toBe(3);
    expect(clampMin(0, 0)).toBe(0);
  });

  it("never returns NaN", () => {
    expect(clampMin(NaN as unknown as number, 1)).toBe(1);
  });
});
