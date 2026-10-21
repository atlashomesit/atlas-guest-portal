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
  /**
   * Founder ruling 2026-10-21: the all-in total for tonight (payment fee included) — the API builds the
   * daily-summary row from the checkout quote, so cards can show what the guest is actually charged.
   */
  finalAmount: number;
  /**
   * TASK-10298998: the payment-fee percent inside `finalAmount` (0 when none), so a no-gateway host's card can
   * take it back out — nothing on that site charges it.
   */
  convenienceFeePercent?: number;
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

/** TASK-4331 / TASK-7016: full server quote from GET /pricing/guest-breakdown — the charge engine
 * (PricingService.GetPublicBreakdownAsync), not the display-only calendar breakdown. */
export type GuestPriceBreakdown = {
  baseAmount: number;
  discountAmount: number;
  /** The tenant's direct-booking discount percent the quote applied (optional for older fixtures). */
  globalDiscountPercent?: number;
  losDiscountAmount: number;
  lastMinuteDiscountAmount: number;
  repeatGuestDiscountAmount: number;
  longStayDiscountAmount: number;
  convenienceFeeAmount: number;
  convenienceFeePercent: number;
  touristTaxAmount: number;
  gstPercent: number | null;
  gstAmount: number | null;
  finalAmount: number | null;
};

/**
 * Room fare after all server-side rule adjustments, before GST/fees/tourist tax.
 *
 * TASK-8293 — the pre- vs post-`BaseAmount` asymmetry, which is the whole trap here:
 *
 *   PRE  (already netted INTO `baseAmount`, so NEVER subtract again):
 *     `losDiscountAmount`, `lastMinuteDiscountAmount`, `longStayDiscountAmount`,
 *     `repeatGuestDiscountAmount`.
 *     `PricingService` reassigns its running `baseAmount` as it applies each rule (LOS →
 *     last-minute → minimum-price floor → long-stay) and `BuildBreakdown` returns
 *     `BaseAmount = RoundCurrency(baseAmount)` — i.e. the POST-rule figure. These four
 *     `*DiscountAmount` fields are REPORTING METADATA describing what each rule took off;
 *     they are not amounts still owed to the guest.
 *
 *   POST (applied AFTER `BaseAmount` is fixed, so it MUST be subtracted here):
 *     `discountAmount` — the tenant GLOBAL discount.
 *     Same convention as every other PricingService DTO in this file:
 *     `CalendarPricingDayDto` (`finalAmount = base − discount`, see `fetchPricingBreakdown`)
 *     and `DailyListingPricingDto` (`actualPrice = base − discount`, see
 *     `getTodayBreakdownFromListing`). `computeCheckoutTotal`
 *     (src/utils/guestPriceEstimate.ts) states the same server contract for this exact
 *     endpoint's `finalAmount`: "base − discount + GST + convenience fee", and backs the GST
 *     line out of it on that basis.
 *
 * The previous implementation subtracted ALL FIVE. On any stay hitting the default long-stay
 * rule (`LongStayDiscounts.Default` = 10% at 7+ nights, applied with no host configuration at
 * all) that deducted the long-stay amount a second time, so the widget's accommodation line
 * came out below the server's own base and the rendered line items no longer summed to the
 * rendered Total — a silent, unexplained gap that reads to a guest as a hidden fee.
 *
 * The floored case is why "subtract the metadata" is wrong rather than merely redundant: when
 * the minimum-price floor clamps `baseAmount`, the rule discounts were only PARTLY realised,
 * so subtracting their full reported value understates the fare by more than was ever given.
 */
export function netChargeableRoomFare(b: GuestPriceBreakdown): number {
  return Math.max(0, b.baseAmount - b.discountAmount);
}

/**
 * MRP-002: Public rate plan DTO returned by GET /api/listings/{listingId}/rate-plans/public.
 */
export type PublicListingRatePlanDto = {
  id: number;
  listingId: number;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  baseNightlyRate: number;
  effectiveNightlyRate: number;
  totalStayAmount: number | null;
  guests: number;
  cancellationPolicy: string | null;
  cancellationSummary: string | null;
  mealPlanCode: string | null;
  mealPlanLabel: string | null;
  isDerived: boolean;
  /**
   * Founder ruling 2026-10-21: the checkout quote for this plan, dates and guest count (same engine as
   * GET /api/pricing/guest-breakdown). Null without dates or from an API that predates the field.
   */
  guestQuote: GuestPriceBreakdown | null;
};

/**
 * MRP-002: Fetch active public rate plans for a listing (and optional date range + guest count).
 */
export async function fetchPublicListingRatePlans(
  listingId: string | number,
  checkIn?: string | null,
  checkOut?: string | null,
  guests?: number | null,
  signal?: AbortSignal,
  tenantSlug?: string | null,
): Promise<PublicListingRatePlanDto[]> {
  const url = new URL(buildApiUrl(`/api/listings/${Number(listingId)}/rate-plans/public`));
  if (checkIn) url.searchParams.set('checkIn', checkIn);
  if (checkOut) url.searchParams.set('checkOut', checkOut);
  if (guests != null && guests > 0) url.searchParams.set('guests', String(guests));

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders(tenantSlug) });
  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const raw = (await response.json()) as Array<Record<string, unknown>>;
  if (!Array.isArray(raw)) return [];

  return raw.map((r) => {
    const totalStayRaw = r.totalStayRate ?? r.TotalStayRate ?? r.totalStayAmount ?? r.TotalStayAmount;
    const cancelPolicyRaw = r.cancellationPolicy ?? r.CancellationPolicy;
    const cancelSummaryRaw = r.cancellationSummary ?? r.CancellationSummary;
    const mealCodeRaw = r.mealPlanCode ?? r.MealPlanCode;
    const mealLabelRaw = r.mealPlanLabel ?? r.MealPlanLabel;
    return {
      id: Number(r.id ?? r.Id ?? 0),
      listingId: Number(r.listingId ?? r.ListingId ?? listingId),
      name: String(r.name ?? r.Name ?? 'Standard Rate'),
      isDefault: Boolean(r.isDefault ?? r.IsDefault),
      sortOrder: Number(r.sortOrder ?? r.SortOrder ?? 0),
      baseNightlyRate: Number(r.baseNightlyRate ?? r.BaseNightlyRate ?? 0),
      effectiveNightlyRate: Number(r.effectiveNightlyRate ?? r.EffectiveNightlyRate ?? 0),
      totalStayAmount:
        totalStayRaw !== undefined && totalStayRaw !== null ? Number(totalStayRaw) : null,
      guests: Number(r.guests ?? r.Guests ?? 2),
      cancellationPolicy:
        typeof cancelPolicyRaw === 'string' && cancelPolicyRaw.trim() ? cancelPolicyRaw : null,
      cancellationSummary:
        typeof cancelSummaryRaw === 'string' && cancelSummaryRaw.trim() ? cancelSummaryRaw : null,
      mealPlanCode: typeof mealCodeRaw === 'string' && mealCodeRaw.trim() ? mealCodeRaw : null,
      mealPlanLabel: typeof mealLabelRaw === 'string' && mealLabelRaw.trim() ? mealLabelRaw : null,
      isDerived: Boolean(r.isDerived ?? r.IsDerived),
      guestQuote: (() => {
        const q = r.guestQuote ?? r.GuestQuote;
        return q && typeof q === 'object' ? mapGuestPriceBreakdown(q as Record<string, unknown>) : null;
      })(),
    };
  });
}

/**
 * GET /pricing/guest-breakdown?listingId=&checkIn=&checkOut= — authoritative pre-checkout quote.
 * TASK-7016: widget totals must derive from this, not from GET /pricing/breakdown calendar rows.
 * MRP-002: optional `listingRatePlanId` selects a specific rate plan's pricing.
 * TASK-10298823: optional `tenantSlug` passes explicit listing owner tenant in headers.
 */
export async function fetchGuestPriceBreakdown(
  listingId: string | number,
  checkIn: string,
  checkOut: string,
  signal?: AbortSignal,
  listingRatePlanId?: number | null,
  guests?: number | null,
  tenantSlug?: string | null,
): Promise<GuestPriceBreakdown> {
  const url = new URL(buildApiUrl(GUEST_BREAKDOWN_ENDPOINT));
  url.searchParams.set('listingId', String(listingId));
  url.searchParams.set('checkIn', checkIn);
  url.searchParams.set('checkOut', checkOut);
  if (listingRatePlanId != null && Number.isFinite(listingRatePlanId) && listingRatePlanId > 0) {
    url.searchParams.set('listingRatePlanId', String(listingRatePlanId));
  }
  if (guests != null && Number.isFinite(guests) && guests > 0) {
    url.searchParams.set('guests', String(Math.floor(guests)));
  }

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders(tenantSlug) });
  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  const raw = (await response.json()) as Record<string, unknown>;
  return mapGuestPriceBreakdown(raw);
}

/** Maps a raw PriceBreakdownDto (camel or Pascal case) to {@link GuestPriceBreakdown}. */
export function mapGuestPriceBreakdown(raw: Record<string, unknown>): GuestPriceBreakdown {
  const num = (camel: string, pascal: string) => {
    const v = raw[camel] ?? raw[pascal];
    return v !== undefined && v !== null ? Number(v) : 0;
  };
  const gstPercent = raw.gstPercent ?? raw.GstPercent;
  const gstAmount = raw.gstAmount ?? raw.GstAmount;
  const finalAmount = raw.finalAmount ?? raw.FinalAmount;

  return {
    baseAmount: num('baseAmount', 'BaseAmount'),
    discountAmount: num('discountAmount', 'DiscountAmount'),
    globalDiscountPercent: num('globalDiscountPercent', 'GlobalDiscountPercent'),
    losDiscountAmount: num('losDiscountAmount', 'LosDiscountAmount'),
    lastMinuteDiscountAmount: num('lastMinuteDiscountAmount', 'LastMinuteDiscountAmount'),
    repeatGuestDiscountAmount: num('repeatGuestDiscountAmount', 'RepeatGuestDiscountAmount'),
    longStayDiscountAmount: num('longStayDiscountAmount', 'LongStayDiscountAmount'),
    convenienceFeeAmount: num('convenienceFeeAmount', 'ConvenienceFeeAmount'),
    convenienceFeePercent: num('convenienceFeePercent', 'ConvenienceFeePercent'),
    touristTaxAmount: num('touristTaxAmount', 'TouristTaxAmount'),
    gstPercent: gstPercent !== undefined && gstPercent !== null ? Number(gstPercent) : null,
    gstAmount: gstAmount !== undefined && gstAmount !== null ? Number(gstAmount) : null,
    finalAmount: finalAmount !== undefined && finalAmount !== null ? Number(finalAmount) : null,
  };
}

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
  listingRatePlanId?: number | null,
  guestsOrTenantSlug?: number | string | null,
  tenantSlug?: string | null,
): Promise<GuestGstBreakdown> {
  const guests = typeof guestsOrTenantSlug === 'number' ? guestsOrTenantSlug : null;
  const effectiveTenant = typeof guestsOrTenantSlug === 'string' ? guestsOrTenantSlug : tenantSlug;
  const b = await fetchGuestPriceBreakdown(listingId, checkIn, checkOut, signal, listingRatePlanId, guests, effectiveTenant);
  return {
    gstPercent: b.gstPercent,
    gstAmount: b.gstAmount,
    finalAmount: b.finalAmount,
  };
}

export async function fetchPricingBreakdown(
  params: PricingBreakdownParams,
  signal?: AbortSignal,
  tenantSlug?: string | null,
): Promise<PricingBreakdown> {
  const url = new URL(buildApiUrl(BREAKDOWN_ENDPOINT));
  url.searchParams.set('listingId', String(params.listingId));
  url.searchParams.set('startDate', params.checkIn);
  url.searchParams.set('months', '1');

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders(tenantSlug) });

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
  tenantSlug?: string | null,
): Promise<CalendarPricingResult> {
  const url = new URL(buildApiUrl(BREAKDOWN_ENDPOINT));
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('listingId', String(listingId));
  url.searchParams.set('months', String(Math.max(1, Math.min(12, months))));

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders(tenantSlug) });
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

/** GET /pricing/daily-summary. Uses server's current date.
 * TASK-7823: pass listingId so a property page does not price the whole catalog. */
export async function fetchDailySummary(signal?: AbortSignal, listingId?: string | number): Promise<DailyPricingSummaryDto> {
  const url = new URL(buildApiUrl(DAILY_SUMMARY_ENDPOINT));
  if (listingId != null && String(listingId).trim() !== '') {
    url.searchParams.set('listingId', String(listingId));
  }
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
  const finalAmount = Number(listing.finalAmount ?? 0);
  return {
    baseAmount,
    actualPrice,
    globalDiscountPercent: Number(listing.globalDiscountPercent ?? 0),
    finalAmount: finalAmount > 0 ? finalAmount : actualPrice,
    convenienceFeePercent: Math.max(0, Number(listing.convenienceFeePercent ?? 0) || 0),
  };
}
