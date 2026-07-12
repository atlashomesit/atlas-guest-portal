import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

export type PricingBreakdown = {
  baseAmount?: number;
  discountAmount?: number;
  convenienceFeeAmount?: number;
  finalAmount?: number;
  /** TASK-571 long-stay discount */
  losDiscountAmount?: number;
  /** TASK-571 long-stay discount percent actually applied */
  losDiscountPercent?: number;
  BaseAmount?: number;
  DiscountAmount?: number;
  ConvenienceFeeAmount?: number;
  FinalAmount?: number;
  LosDiscountAmount?: number;
  LosDiscountPercent?: number;
};

export type PricingBreakdownParams = {
  listingId: string | number;
  checkIn: string;
  checkOut: string;
};

/** Per-listing row from GET /pricing/daily-summary. */
export type DailyListingPricingDto = {
  listingId: number;
  listingName: string;
  baseAmount: number;
  discountAmount: number;
  convenienceFeePercent: number;
  finalAmount: number;
  globalDiscountPercent: number;
};

/** Response from GET /pricing/daily-summary. */
export type DailyPricingSummaryDto = {
  date: string;
  listings: DailyListingPricingDto[];
};

/** Normalized breakdown for UI: actualPrice = baseAmount - discountAmount. */
export type TodayBreakdown = {
  baseAmount: number;
  actualPrice: number;
  globalDiscountPercent: number;
};

/** Per-day row from GET /pricing/breakdown (calendar view). */
export type CalendarPricingDayDto = {
  date: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  globalDiscountPercent?: number;
};

/** One listing's days from calendar breakdown. */
export type CalendarPricingListingDto = {
  listingId: number;
  listingName?: string;
  days: CalendarPricingDayDto[];
};

/** Response from GET /pricing/breakdown?startDate=&listingId=&months= */
export type CalendarPricingViewDto = {
  startDate?: string;
  endDate?: string;
  listings: CalendarPricingListingDto[];
};

const BREAKDOWN_ENDPOINT = '/api/pricing/breakdown';
const GUEST_BREAKDOWN_ENDPOINT = '/api/pricing/guest-breakdown';
const DAILY_SUMMARY_ENDPOINT = '/api/pricing/daily-summary';

/**
 * TASK-4331: GST slab/amount as computed server-side (PricingService.GetPublicBreakdownAsync),
 * i.e. post-LOS/last-minute/min-price-floor adjustment — the SAME basis the Razorpay order
 * amount is charged on (RazorpayPaymentService reads breakdown.GstAmount/GstPercent from this
 * same service call). Null fields mean the request failed or the stay has no nights/base.
 */
export type GuestGstBreakdown = {
  gstPercent: number | null;
  gstAmount: number | null;
  finalAmount: number | null;
};

/**
 * GET /pricing/guest-breakdown?listingId=&checkIn=&checkOut= — server-computed GST slab/amount
 * for a check-in/check-out range. TASK-4331: use this instead of re-deriving the 5%/18% slab
 * client-side from a pre-adjustment per-night rate, which can disagree with the server's
 * post-LOS/last-minute/min-floor basis near the ₹7,500 boundary.
 */
export async function fetchGuestGstBreakdown(
  listingId: string | number,
  checkIn: string,
  checkOut: string,
  signal?: AbortSignal,
): Promise<GuestGstBreakdown> {
  const url = new URL(buildApiUrl(GUEST_BREAKDOWN_ENDPOINT));
  url.searchParams.set('listingId', String(listingId));
  url.searchParams.set('checkIn', checkIn);
  url.searchParams.set('checkOut', checkOut);

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });
  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const raw = (await response.json()) as {
    gstPercent?: number; GstPercent?: number;
    gstAmount?: number; GstAmount?: number;
    finalAmount?: number; FinalAmount?: number;
  };
  const gstPercent = raw.gstPercent ?? raw.GstPercent;
  const gstAmount = raw.gstAmount ?? raw.GstAmount;
  const finalAmount = raw.finalAmount ?? raw.FinalAmount;
  return {
    gstPercent: gstPercent !== undefined && gstPercent !== null ? Number(gstPercent) : null,
    gstAmount: gstAmount !== undefined && gstAmount !== null ? Number(gstAmount) : null,
    finalAmount: finalAmount !== undefined && finalAmount !== null ? Number(finalAmount) : null,
  };
}

export async function fetchPricingBreakdown(
  params: PricingBreakdownParams,
  signal?: AbortSignal,
): Promise<PricingBreakdown> {
  const url = new URL(buildApiUrl(BREAKDOWN_ENDPOINT));
  url.searchParams.set('listingId', String(params.listingId));
  url.searchParams.set('startDate', params.checkIn);
  url.searchParams.set('months', '1');

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const raw = (await response.json()) as {
    listings?: { listingId?: number; ListingId?: number; days?: Record<string, unknown>[]; Days?: Record<string, unknown>[] }[];
    Listings?: { listingId?: number; ListingId?: number; days?: Record<string, unknown>[]; Days?: Record<string, unknown>[] }[];
  };
  const listings = raw.listings ?? raw.Listings ?? [];
  const targetId = Number(params.listingId);

  for (const listing of listings) {
    const id = listing.listingId ?? listing.ListingId;
    if (id !== targetId) continue;
    const days = listing.days ?? listing.Days ?? [];

    let totalBase = 0;
    let totalDiscount = 0;
    let convenienceFeePercent = 0;

    for (const d of days) {
      const dayDate = String(d.date ?? d.Date ?? '').slice(0, 10);
      if (dayDate && params.checkOut) {
        if (dayDate < params.checkIn || dayDate >= params.checkOut) continue;
      }
      const base = Number(d.baseAmount ?? d.BaseAmount ?? 0);
      // TASK-4322: `discountAmount` here is the summed per-day tenant GLOBAL discount
      // (CalendarPricingDayDto has no LOS field at all — the calendar endpoint doesn't
      // expose genuine TASK-571 long-stay discounts). It must NOT be labeled/returned as
      // `losDiscountAmount` — doing so caused UnitBookingWidget to subtract this same
      // discount a second time (it's already netted into `actualPrice` below / in
      // fetchCalendarPricing), understating the displayed total vs. what the server charges.
      const discount = Number(d.discountAmount ?? d.DiscountAmount ?? 0);
      totalBase += base;
      totalDiscount += discount;
      if (convenienceFeePercent === 0) {
        const pct = d.convenienceFeePercent ?? d.ConvenienceFeePercent;
        if (pct !== undefined && pct !== null) convenienceFeePercent = Number(pct);
      }
    }

    return {
      baseAmount: totalBase,
      discountAmount: totalDiscount,
      convenienceFeeAmount: Math.round((totalBase * convenienceFeePercent) / 100),
      // TASK-4322: no genuine LOS field exists in this calendar DTO — never populate
      // losDiscountAmount/losDiscountPercent from the global discount. Leave at 0 until
      // TASK-571 wires a real per-day LOS field into CalendarPricingDayDto.
      losDiscountAmount: 0,
      losDiscountPercent: 0,
      finalAmount: totalBase - totalDiscount,
    };
  }

  return {};
}

/** Result of GET /pricing/breakdown calendar pricing: per-day prices and convenience fee percent from API (no default). */
export type CalendarPricingResult = {
  dateToPrice: Map<string, number>;
  convenienceFeePercent?: number;
};

/** GET /pricing/breakdown?startDate=YYYY-MM-DD&listingId=&months= — returns per-day pricing and convenienceFeePercent from API. */
export async function fetchCalendarPricing(
  listingId: string | number,
  startDate: string,
  months: number = 2,
  signal?: AbortSignal,
): Promise<CalendarPricingResult> {
  const url = new URL(buildApiUrl(BREAKDOWN_ENDPOINT));
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('listingId', String(listingId));
  url.searchParams.set('months', String(Math.max(1, Math.min(12, months))));

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });
  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const raw = (await response.json()) as {
    listings?: { listingId?: number; ListingId?: number; days?: Record<string, unknown>[]; Days?: Record<string, unknown>[] }[];
    Listings?: { listingId?: number; ListingId?: number; days?: Record<string, unknown>[]; Days?: Record<string, unknown>[] }[];
  };
  const listings = raw.listings ?? raw.Listings ?? [];
  const map = new Map<string, number>();
  let convenienceFeePercent: number | undefined;
  const targetId = Number(listingId);

  for (const listing of listings) {
    const id = listing.listingId ?? listing.ListingId;
    if (id !== targetId) continue;
    const days = listing.days ?? listing.Days ?? [];
    for (const d of days) {
      const dateStr = (d.date ?? d.Date) as string | undefined;
      if (!dateStr) continue;
      const base = Number(d.baseAmount ?? d.BaseAmount ?? 0);
      const discount = Number(d.discountAmount ?? d.DiscountAmount ?? 0);
      // Guard against NaN values (non-numeric data from server)
      if (isNaN(base) || isNaN(discount)) continue;
      const actualPrice = Math.max(0, base - discount);
      map.set(dateStr, actualPrice);
      if (convenienceFeePercent === undefined) {
        const pct = d.convenienceFeePercent ?? d.ConvenienceFeePercent;
        if (pct !== undefined && pct !== null) convenienceFeePercent = Number(pct);
      }
    }
    break;
  }
  return { dateToPrice: map, convenienceFeePercent };
}

/** GET /pricing/daily-summary. Uses server's current date. Fetch once and reuse. */
export async function fetchDailySummary(signal?: AbortSignal): Promise<DailyPricingSummaryDto> {
  const url = new URL(buildApiUrl(DAILY_SUMMARY_ENDPOINT));
  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const raw = (await response.json()) as {
    Date?: string;
    date?: string;
    Listings?: Record<string, unknown>[];
    listings?: Record<string, unknown>[];
  };
  const rows = raw.Listings ?? raw.listings ?? [];
  const date = raw.Date ?? raw.date ?? '';
  const listings: DailyListingPricingDto[] = rows.map((l) => {
    const base = (l.baseAmount ?? l.BaseAmount) as number | undefined;
    const discount = (l.discountAmount ?? l.DiscountAmount) as number | undefined;
    const conv = (l.convenienceFeePercent ?? l.ConvenienceFeePercent) as number | undefined;
    const final = (l.finalAmount ?? l.FinalAmount) as number | undefined;
    const global = (l.globalDiscountPercent ?? l.GlobalDiscountPercent) as number | undefined;
    return {
      listingId: Number(l.listingId ?? l.ListingId),
      listingName: String(l.listingName ?? l.ListingName ?? ''),
      baseAmount: Number(base ?? 0),
      discountAmount: Number(discount ?? 0),
      convenienceFeePercent: Number(conv ?? 0),
      finalAmount: Number(final ?? 0),
      globalDiscountPercent: Number(global ?? 0),
    };
  });
  return { date, listings };
}

export function getTodayBreakdownFromListing(listing: DailyListingPricingDto): TodayBreakdown {
  const baseAmount = Number(listing.baseAmount);
  const discountAmount = Number(listing.discountAmount ?? 0);
  const actualPrice = baseAmount - discountAmount;
  return {
    baseAmount,
    actualPrice,
    globalDiscountPercent: Number(listing.globalDiscountPercent ?? 0),
  };
}
