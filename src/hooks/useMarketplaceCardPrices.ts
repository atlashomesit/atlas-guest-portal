import { useEffect, useMemo, useState } from 'react';
import {
  fetchDailySummary,
  fetchGuestPriceBreakdown,
  getTodayBreakdownFromListing,
} from '@/api/pricingClient';
import { directPriceDisplay, type DirectPriceDisplay } from '@/utils/directBookingPrice';

/**
 * TASK-10298999 (founder ruling 2026-10-21: the website price shown = the price charged).
 *
 * www.atlastays.com marketplace cards used to print the listing row's `pricePerNight` (the listing's
 * standard nightly rate) plus a client-side "3% est. total" — ₹3,500 / ₹7,210 for flats whose real
 * 2-night total is ₹5,451 — while the tenant homepage and the booking box read the checkout quote.
 * Each card now asks the same engine the listing page and checkout use, scoped to the home's own host:
 *
 *   - searched dates → `GET /api/pricing/guest-breakdown` for exactly those dates and guests
 *     (the quote the booking box and checkout charge);
 *   - no dates       → `GET /api/pricing/daily-summary?listingId=` (tonight, one night — the row the API
 *     builds from that same quote, which is what the tenant homepage cards show).
 */
export type MarketplaceCardPriceItem = {
  id: number;
  tenantSlug: string;
  /** MKT-001 / TASK-7428: false for a host with no online gateway — no processor, no fee. */
  chargesOnlinePaymentFee?: boolean;
};

export type MarketplaceStay = {
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
};

export type MarketplaceCardPrice =
  | { status: 'loading' }
  | { status: 'ready'; display: DirectPriceDisplay }
  | { status: 'unavailable' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizes a date-like string (e.g. '2026-10-30' or '2026-10-30T00:00:00.000Z') to 'YYYY-MM-DD'.
 * Returns null if the value is missing or invalid.
 */
export function toMarketplaceDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const dateStr = match[1];
  const parsed = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : dateStr;
}

/** Whole nights between two yyyy-MM-dd dates, or null when the pair is not a valid stay. */
export function marketplaceStayNights(checkIn: string | null, checkOut: string | null): number | null {
  const dIn = toMarketplaceDateOnly(checkIn);
  const dOut = toMarketplaceDateOnly(checkOut);
  if (!dIn || !dOut) return null;
  const nights = Math.round((Date.parse(`${dOut}T00:00:00Z`) - Date.parse(`${dIn}T00:00:00Z`)) / 86_400_000);
  return Number.isFinite(nights) && nights > 0 ? nights : null;
}

/** The card's price, from the same quote the listing page and checkout use. Null = no price we can stand behind. */
export async function fetchMarketplaceCardPrice(
  item: MarketplaceCardPriceItem,
  stay: MarketplaceStay,
  signal?: AbortSignal,
): Promise<DirectPriceDisplay | null> {
  const paymentFeeCharged = item.chargesOnlinePaymentFee !== false;
  const checkIn = toMarketplaceDateOnly(stay.checkIn);
  const checkOut = toMarketplaceDateOnly(stay.checkOut);
  const nights = marketplaceStayNights(checkIn, checkOut);

  if (nights != null && checkIn && checkOut) {
    const quote = await fetchGuestPriceBreakdown(
      item.id,
      checkIn,
      checkOut,
      signal,
      null,
      stay.guests,
      item.tenantSlug,
    );
    return directPriceDisplay({
      baseAmount: quote.baseAmount,
      discountAmount: quote.discountAmount,
      finalAmount: quote.finalAmount,
      nights,
      paymentFeeCharged,
      paymentFeeAmount: quote.convenienceFeeAmount,
    });
  }

  const summary = await fetchDailySummary(signal, item.id, item.tenantSlug);
  const row = summary.listings.find((l) => l.listingId === item.id);
  if (!row) return null;
  const today = getTodayBreakdownFromListing(row);
  return directPriceDisplay({
    baseAmount: today.baseAmount,
    discountAmount: today.baseAmount - today.actualPrice,
    finalAmount: today.finalAmount,
    nights: 1,
    paymentFeeCharged,
    paymentFeeAmount: (today.actualPrice * (today.convenienceFeePercent ?? 0)) / 100,
  });
}

/** Same 5-minute bound the daily-summary cache uses (TASK-102563): never quote a retired rate. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { display: DirectPriceDisplay | null; storedAt: number }>();

function cacheKey(item: MarketplaceCardPriceItem, stay: MarketplaceStay): string {
  const checkIn = toMarketplaceDateOnly(stay.checkIn);
  const checkOut = toMarketplaceDateOnly(stay.checkOut);
  return [item.tenantSlug, item.id, checkIn ?? '', checkOut ?? '', stay.guests ?? ''].join('|');
}

/** Test seam: forget every cached card price. */
export function clearMarketplaceCardPriceCache(): void {
  cache.clear();
}

/** At most this many quote requests in flight from one page (the public_guest limit is per IP). */
const MAX_CONCURRENT = 6;

export function useMarketplaceCardPrices(
  items: MarketplaceCardPriceItem[],
  stay: MarketplaceStay,
): Map<number, MarketplaceCardPrice> {
  const [prices, setPrices] = useState<Map<number, MarketplaceCardPrice>>(() => new Map());

  const checkIn = toMarketplaceDateOnly(stay.checkIn);
  const checkOut = toMarketplaceDateOnly(stay.checkOut);

  // Re-run only when the set of homes or the stay changes, not on every new array identity.
  const itemsKey = items.map((i) => `${i.tenantSlug}:${i.id}:${i.chargesOnlinePaymentFee}`).join(',');
  const stayKey = `${checkIn ?? ''}|${checkOut ?? ''}|${stay.guests ?? ''}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableItems = useMemo(() => items, [itemsKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableStay = useMemo<MarketplaceStay>(() => ({ checkIn, checkOut, guests: stay.guests }), [stayKey]);

  useEffect(() => {
    const controller = new AbortController();
    const initial = new Map<number, MarketplaceCardPrice>();
    const pending: MarketplaceCardPriceItem[] = [];
    for (const item of stableItems) {
      const hit = cache.get(cacheKey(item, stableStay));
      if (hit && Date.now() - hit.storedAt < CACHE_TTL_MS) {
        initial.set(item.id, hit.display ? { status: 'ready', display: hit.display } : { status: 'unavailable' });
      } else {
        initial.set(item.id, { status: 'loading' });
        pending.push(item);
      }
    }
    setPrices(initial);

    let next = 0;
    const worker = async () => {
      while (next < pending.length && !controller.signal.aborted) {
        const item = pending[next++];
        let display: DirectPriceDisplay | null = null;
        try {
          display = await fetchMarketplaceCardPrice(item, stableStay, controller.signal);
          cache.set(cacheKey(item, stableStay), { display, storedAt: Date.now() });
        } catch {
          // No quote (network, unbookable dates, host not set up): show no number rather than a guessed one.
          display = null;
        }
        if (controller.signal.aborted) return;
        setPrices((prev) => {
          const m = new Map(prev);
          m.set(item.id, display ? { status: 'ready', display } : { status: 'unavailable' });
          return m;
        });
      }
    };
    void Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, pending.length) }, worker));

    return () => controller.abort();
  }, [stableItems, stableStay]);

  return prices;
}
