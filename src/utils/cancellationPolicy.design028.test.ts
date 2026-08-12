/**
 * DESIGN-028 — three-surface cancellation trust helpers.
 */
import { describe, expect, it } from "vitest";
import {
  resolveHeroRefundProcessingChip,
  resolveListingCardCancellationChip,
} from "./cancellationPolicy";

describe("DESIGN-028 trust helpers", () => {
  it("hero processing chip is unconditional and does not invent free-cancel windows", () => {
    const chip = resolveHeroRefundProcessingChip();
    expect(chip).toMatch(/refunds approved within 24 hours/i);
    expect(chip).not.toMatch(/48h|7 days|15 days|free cancellation/i);
  });

  it("listing card chip uses tier prose (Flexible / Moderate / Strict)", () => {
    expect(resolveListingCardCancellationChip("Flexible")).toMatch(/full refund any time/i);
    expect(resolveListingCardCancellationChip("Moderate")).toMatch(/5\+/i);
    expect(resolveListingCardCancellationChip("Strict")).toMatch(/7\+/i);
    // Untiered listings resolve to Flexible server-side — same headline, not a fabricated hour count.
    expect(resolveListingCardCancellationChip(null)).toMatch(/full refund any time/i);
  });
});
