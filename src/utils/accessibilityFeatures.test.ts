import { describe, expect, it } from "vitest";
import {
  ACCESSIBILITY_CHIP_LABELS,
  ACCESSIBILITY_FEATURE_CODES,
  ACCESSIBILITY_UNKNOWN_COPY,
  amenityCodeMatchesCategory,
  getAccessibilityDeclarations,
  isAccessibilityUnknown,
} from "./amenityCodes";

describe("TASK-10086 step-free discovery vocabulary", () => {
  it("exposes exactly the v1 trio of canonical codes", () => {
    expect([...ACCESSIBILITY_FEATURE_CODES].sort()).toEqual(
      ["accessible_parking", "elevator", "step_free_entrance"].sort(),
    );
  });

  it("carries the trio in the amenity filter contract without free-text matching", () => {
    expect(amenityCodeMatchesCategory("step_free_entrance", "step-free-entrance")).toBe(true);
    expect(amenityCodeMatchesCategory("Step_Free_Entrance", "step-free-entrance")).toBe(true);
    expect(amenityCodeMatchesCategory("elevator", "lift-access")).toBe(true);
    expect(amenityCodeMatchesCategory("accessible_parking", "accessible-parking")).toBe(true);
  });

  it("never infers accessibility from loose prose or neighbouring codes", () => {
    expect(amenityCodeMatchesCategory("stepfree ramp", "step-free-entrance")).toBe(false);
    expect(amenityCodeMatchesCategory("wheelchair_accessible", "step-free-entrance")).toBe(false);
    expect(amenityCodeMatchesCategory("parking_free", "accessible-parking")).toBe(false);
    expect(amenityCodeMatchesCategory("lift", "lift-access")).toBe(false);
    expect(getAccessibilityDeclarations(["stepfree ramp", "wheelchair_accessible", "parking", ""])).toEqual([]);
  });

  it("extracts only explicit declarations, case-insensitively", () => {
    expect(getAccessibilityDeclarations(["step_free_entrance", "wifi"])).toEqual(["step_free_entrance"]);
    // Input order is preserved; matching itself is case-insensitive.
    expect(getAccessibilityDeclarations(["ELEVATOR", "Step_Free_Entrance"])).toEqual([
      "elevator",
      "step_free_entrance",
    ]);
  });

  it("treats missing declarations as unknown, never as accessible", () => {
    expect(isAccessibilityUnknown([])).toBe(true);
    expect(isAccessibilityUnknown(["wifi", "pool"])).toBe(true);
    expect(isAccessibilityUnknown(["accessible_parking"])).toBe(false);
    expect(ACCESSIBILITY_UNKNOWN_COPY).toBe("Not specified \u2014 ask host");
  });

  it("labels every accessibility chip", () => {
    expect(ACCESSIBILITY_CHIP_LABELS["step-free-entrance"]).toBe("Step-free entrance");
    expect(ACCESSIBILITY_CHIP_LABELS["lift-access"]).toBe("Lift/elevator access");
    expect(ACCESSIBILITY_CHIP_LABELS["accessible-parking"]).toBe("Accessible parking");
  });
});
