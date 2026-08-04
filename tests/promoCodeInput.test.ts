import { describe, expect, it } from "vitest";
import {
  PROMO_CODE_MAX_LENGTH,
  normalizePromoCodeInput,
  normalizePromoCodeSubmit,
} from "../src/utils/promoCodeInput";

describe("promoCodeInput (TASK-6025)", () => {
  it("preserves hyphen, underscore, and space while typing", () => {
    expect(normalizePromoCodeInput("summer-20")).toBe("SUMMER-20");
    expect(normalizePromoCodeInput("direct_5")).toBe("DIRECT_5");
    expect(normalizePromoCodeInput("save 10")).toBe("SAVE 10");
  });

  it("uppercases and caps length at submit boundary", () => {
    expect(normalizePromoCodeSubmit("  summer-20  ")).toBe("SUMMER-20");
    expect(normalizePromoCodeInput("a".repeat(PROMO_CODE_MAX_LENGTH + 5))).toHaveLength(
      PROMO_CODE_MAX_LENGTH,
    );
  });
});
