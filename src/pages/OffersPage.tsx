/* eslint-disable atlas-brand/no-atlas-string-leak -- Task 16: per-tenant promo codes wired via API */
import { useEffect, useRef, useState } from "react";
import SEO from "../components/SEO";
import { buildApiUrl } from "@/api/client";
import { useTenantListings, type TenantPropertyRecord } from "@/hooks/useTenantListings";

interface DiscountTier {
  minNights: number;
  percent: number;
}

interface PromoResult {
  valid: boolean;
  message: string;
  discountType?: string | null;
  discountValue?: number;
  discountAmount?: number;
}

function extractDiscountTiers(properties: TenantPropertyRecord[]): DiscountTier[] {
  const tiers = new Map<number, number>();
  for (const p of properties) {
    if ((p.losDiscountMinNights ?? 0) > 0 && (p.losDiscountPercent ?? 0) > 0) {
      const existing = tiers.get(p.losDiscountMinNights!) ?? 0;
      if ((p.losDiscountPercent ?? 0) > existing) tiers.set(p.losDiscountMinNights!, p.losDiscountPercent!);
    }
    if ((p.losDiscount2MinNights ?? 0) > 0 && (p.losDiscount2Percent ?? 0) > 0) {
      const existing = tiers.get(p.losDiscount2MinNights!) ?? 0;
      if ((p.losDiscount2Percent ?? 0) > existing) tiers.set(p.losDiscount2MinNights!, p.losDiscount2Percent!);
    }
  }
  return Array.from(tiers.entries())
    .map(([minNights, percent]) => ({ minNights, percent }))
    .sort((a, b) => a.minNights - b.minNights);
}

function extractLastMinutePercent(properties: TenantPropertyRecord[]): number {
  return Math.max(0, ...properties.map((p) => p.lastMinuteDiscountPercent ?? 0));
}

export default function OffersPage() {
  const { properties, state } = useTenantListings();

  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const discountTiers = state === "success" ? extractDiscountTiers(properties) : [];
  const lastMinutePercent = state === "success" ? extractLastMinutePercent(properties) : 0;

  useEffect(() => {
    setPromoResult(null);
  }, [promoCode]);

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const res = await fetch(buildApiUrl("/api/promo-codes/validate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, listingId: 0, subtotal: 10000 }),
      });
      const data = (await res.json()) as PromoResult;
      setPromoResult(data);
    } catch {
      setPromoResult({ valid: false, message: "Could not check code. Please try at checkout." });
    } finally {
      setPromoLoading(false);
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).catch(() => undefined);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-bg-muted px-4 md:px-10 lg:px-20 py-24">
      <SEO title="Offers | Atlas Homestays" description="Direct booking deals, extended-stay discounts, and promo codes for Atlas Homestays guests." />

      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header */}
        <div className="space-y-2">
          <p className="uppercase tracking-[0.2em] text-brand-primary font-semibold text-sm">Atlas Homestays</p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">Exclusive Offers</h1>
          <p className="text-lg text-text-muted">Book direct and unlock the best rates — no OTA fees, no middlemen.</p>
        </div>

        {/* Direct booking deal */}
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-3xl">🎁</div>
          <div className="flex-1">
            <h2 className="font-bold text-emerald-900 text-lg">Direct Booking Discount</h2>
            <p className="text-emerald-800 text-sm mt-1">Use promo code <strong>DIRECT5</strong> at checkout for 5% off any direct booking.</p>
          </div>
          <button
            type="button"
            onClick={() => handleCopy("DIRECT5")}
            className="self-start sm:self-center inline-flex items-center gap-2 rounded-xl bg-white border border-emerald-300 px-4 py-2 font-mono font-bold text-emerald-700 text-sm hover:bg-emerald-50 transition"
            aria-label="Copy DIRECT5 promo code"
          >
            DIRECT5
            <span className="text-xs font-normal text-emerald-500">{copied === "DIRECT5" ? "Copied!" : "Copy"}</span>
          </button>
        </div>

        {/* LOS discount tiers */}
        {(state === "loading" || discountTiers.length > 0) && (
          <div className="space-y-4">
            <h2 className="font-bold text-text-primary text-xl">Extended-Stay Discounts</h2>
            {state === "loading" ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Loading current deals…
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {discountTiers.map((tier) => (
                  <div
                    key={tier.minNights}
                    className="rounded-xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3"
                  >
                    <span className="text-2xl mt-0.5">🏷</span>
                    <div>
                      <p className="font-bold text-amber-900 text-base">
                        Stay {tier.minNights}+ nights
                      </p>
                      <p className="text-amber-800 text-sm mt-0.5">
                        Save <strong>{Math.round(tier.percent)}%</strong> — automatically applied at checkout
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Last-minute discount */}
        {lastMinutePercent > 0 && (
          <div className="rounded-2xl bg-sky-50 border border-sky-200 p-6 flex items-start gap-4">
            <div className="text-3xl">⚡</div>
            <div>
              <h2 className="font-bold text-sky-900 text-lg">Last-Minute Deals</h2>
              <p className="text-sky-800 text-sm mt-1">
                Book check-in within 48 hours and save <strong>{Math.round(lastMinutePercent)}%</strong> — applied automatically.
              </p>
            </div>
          </div>
        )}

        {/* Promo code checker */}
        <div className="rounded-2xl bg-bg-surface border border-border-subtle shadow-level1 p-6 space-y-4">
          <h2 className="font-bold text-text-primary text-xl">Have a Promo Code?</h2>
          <p className="text-text-muted text-sm">Enter your code below to check its validity before booking.</p>
          <form onSubmit={handleValidate} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))}
              placeholder="e.g. SUMMER25"
              className="flex-1 rounded-xl border border-border-subtle bg-white px-4 py-2.5 text-sm font-mono uppercase tracking-widest text-text-primary placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-brand-primary"
              aria-label="Promo code"
              maxLength={32}
            />
            <button
              type="submit"
              disabled={!promoCode.trim() || promoLoading}
              className="rounded-xl bg-cta-primary px-5 py-2.5 text-sm font-semibold text-[var(--text-contrast)] shadow-level1 hover:shadow-level2 transition disabled:opacity-50"
            >
              {promoLoading ? "Checking…" : "Check"}
            </button>
          </form>

          {promoResult && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                promoResult.valid
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
              role="status"
            >
              {promoResult.valid ? "✓ " : "✗ "}
              {promoResult.message}
              {promoResult.valid && promoCode && (
                <button
                  type="button"
                  onClick={() => handleCopy(promoCode)}
                  className="ml-3 underline underline-offset-2 hover:opacity-75"
                >
                  {copied === promoCode ? "Copied!" : "Copy code"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Browse properties CTA */}
        <div className="rounded-2xl bg-bg-surface border border-border-subtle shadow-level1 p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <h2 className="font-bold text-text-primary text-lg">Ready to book?</h2>
            <p className="text-text-muted text-sm mt-1">Browse all apartments and apply your discount at checkout.</p>
          </div>
          <a
            href="/apartments"
            className="inline-flex items-center gap-2 rounded-xl bg-cta-primary px-6 py-3 font-semibold text-[var(--text-contrast)] shadow-level1 hover:shadow-level2 transition text-sm"
          >
            View apartments →
          </a>
        </div>
      </div>
    </div>
  );
}
