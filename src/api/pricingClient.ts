import { buildApiUrl, getApiHeaders } from '@/api/client';

export type PricingBreakdown = {
  baseAmount?: number;
  discountAmount?: number;
  convenienceFeeAmount?: number;
  finalAmount?: number;
  BaseAmount?: number;
  DiscountAmount?: number;
  ConvenienceFeeAmount?: number;
  FinalAmount?: number;
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

const BREAKDOWN_ENDPOINT = '/pricing/breakdown';
const DAILY_SUMMARY_ENDPOINT = '/pricing/daily-summary';

export async function fetchPricingBreakdown(
  params: PricingBreakdownParams,
  signal?: AbortSignal,
): Promise<PricingBreakdown> {
  const url = new URL(buildApiUrl(BREAKDOWN_ENDPOINT));
  url.searchParams.set('listingId', String(params.listingId));
  url.searchParams.set('checkIn', params.checkIn);
  url.searchParams.set('checkOut', params.checkOut);

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });

  if (!response.ok) {
    throw new Error(`Pricing breakdown failed with status ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return data as PricingBreakdown;
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
    throw new Error(`Calendar pricing failed with status ${response.status}`);
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
    throw new Error(`Daily pricing summary failed with status ${response.status}`);
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
