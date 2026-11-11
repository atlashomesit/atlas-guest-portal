import { describe, expect, it } from "vitest";
import { priceDisplayConfig } from "./priceDisplay.config";

describe("priceDisplayConfig — TASK-10299280 F3 (CCPA dark-pattern honesty)", () => {
  it("omits secondaryBadgeLabel and carries no 'Limited-time deal' urgency wording", () => {
    expect("secondaryBadgeLabel" in priceDisplayConfig.discount).toBe(false);
    expect(JSON.stringify(priceDisplayConfig)).not.toMatch(/limited-time deal/i);
    expect(priceDisplayConfig.discount.primaryBadgeLabel).toBe("Best price on our website");
  });
});
