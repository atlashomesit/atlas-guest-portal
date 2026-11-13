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
    expect(resolveListingCardCancellationChip("Flexible")).toMatch(/free cancellation up to 48 hours/i); // TASK-1040050: the same window the rate card reads
    expect(resolveListingCardCancellationChip("Moderate")).toMatch(/up to 5 days/i);
    expect(resolveListingCardCancellationChip("Strict")).toMatch(/up to 7 days/i);
    // Untiered listings get the server default window (7 days, RefundDeadlineResolver) — never a fabricated hour count.
    expect(resolveListingCardCancellationChip(null)).toMatch(/up to 7 days/i);
  });
});
