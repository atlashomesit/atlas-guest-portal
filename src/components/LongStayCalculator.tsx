/**
 * TASK-1739: Monthly stay calculator — effective ₹/night for different stay lengths.
 *
 * Shows a stay-length toggle (1/7/14/28 nights) with effective price per night
 * after applying configured LOS (Length-of-Stay) auto-discount tiers.
 * Only renders when at least one discount tier is configured.
 */
import React, { useState } from "react";

interface LongStayCalculatorProps {
  /** Base nightly price in INR. */
  pricePerNight: number;
  /** Tier 1 minimum nights for discount (e.g. 7). */
  tier1MinNights?: number | null;
  /** Tier 1 discount percent (e.g. 10 for 10%). */
  tier1Percent?: number | null;
  /** Tier 2 minimum nights for a deeper discount (e.g. 28). */
  tier2MinNights?: number | null;
  /** Tier 2 discount percent (e.g. 20 for 20%). */
  tier2Percent?: number | null;
}

const PRESETS = [1, 7, 14, 28] as const;

function getDiscountPercent(
  nights: number,
  tier1MinNights: number | null | undefined,
  tier1Percent: number | null | undefined,
  tier2MinNights: number | null | undefined,
  tier2Percent: number | null | undefined,
): number {
  if (tier2MinNights && tier2Percent && nights >= tier2MinNights) return tier2Percent;
  if (tier1MinNights && tier1Percent && nights >= tier1MinNights) return tier1Percent;
  return 0;
}

const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function LongStayCalculator({
  pricePerNight,
  tier1MinNights,
  tier1Percent,
  tier2MinNights,
  tier2Percent,
}: LongStayCalculatorProps) {
  const [selected, setSelected] = useState<(typeof PRESETS)[number]>(1);

  // Only show when at least one tier is configured
  const hasAnyTier =
    (tier1MinNights && tier1Percent) || (tier2MinNights && tier2Percent);
  if (!hasAnyTier || !pricePerNight) return null;

  const discountPct = getDiscountPercent(
    selected,
    tier1MinNights,
    tier1Percent,
    tier2MinNights,
    tier2Percent,
  );
  const effectiveNightly = pricePerNight * (1 - discountPct / 100);
  const totalCost = effectiveNightly * selected;

  return (
    <div className="mt-2 rounded-xl border border-border-subtle bg-bg-muted px-3 py-2">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Stay calculator
      </p>
      <div className="flex gap-1.5">
        {PRESETS.map((nights) => {
          const disc = getDiscountPercent(
            nights, tier1MinNights, tier1Percent, tier2MinNights, tier2Percent,
          );
          return (
            <button
              key={nights}
              onClick={() => setSelected(nights)}
              className={`flex-1 rounded-lg border px-1 py-1.5 text-center text-xs transition-colors ${
                selected === nights
                  ? "border-cta-primary bg-cta-primary text-white"
                  : "border-border-subtle bg-bg-surface text-text-secondary hover:border-cta-primary"
              }`}
            >
              <span className="font-semibold">{nights}N</span>
              {disc > 0 && (
                <span className="ml-0.5 text-xs opacity-80">-{disc}%</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="text-xs text-text-muted">
          {selected > 1 ? `Total (${selected} nights)` : "Per night"}
        </span>
        <span className="text-sm font-bold text-text-primary">
          {selected > 1 ? formatINR(totalCost) : formatINR(effectiveNightly)}
          {selected > 1 && (
            <span className="ml-1 text-xs font-normal text-text-muted">
              ({formatINR(effectiveNightly)}/night)
            </span>
          )}
        </span>
        {discountPct > 0 && (
          <span className="text-[11px] font-medium text-emerald-600">
            Save {discountPct}%
          </span>
        )}
      </div>
    </div>
  );
}
