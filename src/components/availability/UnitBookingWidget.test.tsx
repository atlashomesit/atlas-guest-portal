import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import axios, { AxiosError } from 'axios';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import {
  getOrderCreationGuestErrorMessage,
  PROVIDER_NOT_CONFIGURED_WHATSAPP_HINT,
} from './unitBookingPaymentOrderErrors';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';

// ---- TASK-4303 render-test mocks (hoisted; only the render suite below imports the widget) ----
const task4303 = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestGstBreakdown: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
}));

// TASK-4830: a configurable availability-fetch mock so the failure suite below can make the
// availability GET reject/404 and assert Reserve fail-closes. Defaults to an empty 200 body
// (all dates available) so the existing TASK-4303 render suite is unaffected.
const availabilityOk = () =>
  new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
const availabilityMock = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));
vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: (...args: unknown[]) => availabilityMock.fetch(...args),
}));
// Default: availability GET succeeds with an empty (all-available) calendar.
availabilityMock.fetch.mockImplementation(availabilityOk);
vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: task4303.fetchCalendarPricing,
  fetchGuestGstBreakdown: task4303.fetchGuestGstBreakdown,
}));
vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: task4303.booking, updateBooking: vi.fn() }),
}));
vi.mock('@/contexts/ListingPhotosContext', () => ({
  useListingPhotosFromApi: () => ({ getUrlsForListingId: () => undefined }),
}));
vi.mock('@/hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({
    data: null,
    loading: false,
    error: null,
    // Base card rate ₹6,000 — the stale provisional source TASK-4303 must never render as a total.
    getListingPricing: () => ({ baseAmount: 6000, actualPrice: 6000, globalDiscountPercent: 0 }),
  }),
}));
vi.mock('@/components/FomoBar', () => ({ default: () => null }));
vi.mock('@/lib/events', () => ({ track: vi.fn() }));
vi.mock('./AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));

describe('UnitBookingWidget - TASK-2460: order API errors surface body.message', () => {
  it('422 PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT includes API message and WhatsApp hint', () => {
    const apiMessage = 'Online payment is not configured for this property.';
    const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422,
      statusText: 'Unprocessable Entity',
      data: {
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT',
        message: apiMessage,
      },
      headers: {},
      config: {} as never,
    });
    const text = getOrderCreationGuestErrorMessage(err, 'fallback');
    expect(text).toContain(apiMessage);
    expect(text).toContain(PROVIDER_NOT_CONFIGURED_WHATSAPP_HINT);
  });
});

describe('UnitBookingWidget - TASK-2612: Button text is "Reserve" (two-step flow)', () => {
  it('button text contains "Reserve" and not "Book Now" after TASK-2612 two-step flow', () => {
    const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
    const content = readFileSync(filePath, 'utf-8');

    // TASK-2612: Reserve button — widget only does init-hold, form is on GuestDetailsPage
    expect(content).toContain("'Reserve'");
    expect(content).not.toContain("'Book Now'");

    // Verify the button has disabled conditions including date checks
    expect(content).toContain('!dateRange.startDate');
    expect(content).toContain('!dateRange.endDate');
  });
});

describe('UnitBookingWidget - TASK-2623: .bw-* design header, price labels, trust strip', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
  let content: string;

  it('reads widget source', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toBeTruthy();
  });

  it('has v2 headline block with per-night price display and "/ night" copy (listing-detail-v2 redesign)', () => {
    // v2 redesign (2026-05-21): lv-booking-headline replaces bw-head/bw-price-block.
    // bw-* layout classes removed; lv-* design tokens now drive the headline.
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('lv-booking-headline');
    expect(content).toContain('lv-booking-total');
    expect(content).toContain('/ night');
  });

  it('renders AtlasBookingCalendar (not a legacy plain calendar)', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('AtlasBookingCalendar');
    // Legacy react-date-range should not be used directly
    expect(content).not.toContain('react-date-range');
  });

  it('has reviewRating and reviewCount props for bw-rating block', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('reviewRating');
    expect(content).toContain('reviewCount');
    expect(content).toContain('bw-rating');
    // Rating block only shown when reviewCount > 0
    expect(content).toContain('reviewCount > 0');
  });

  it('price breakdown uses "× N nights" subtotal label (not "Room fare")', () => {
    content = readFileSync(filePath, 'utf-8');
    // New label should contain × N nights
    expect(content).toContain('× ${priceDetails.nights}');
    // Legacy "Room fare" label should be gone
    expect(content).not.toContain('>Room fare<');
  });

  it('GST row is standardized to "GST (N%)" with no redundant "on accommodation" sublabel (TASK-4097)', () => {
    content = readFileSync(filePath, 'utf-8');
    // TASK-4097 (PR #242, commit 54200ec3) deliberately dropped the redundant
    // "on accommodation" sublabel and standardized the GST row to "GST (N%)".
    expect(content).toContain('GST ({gstSlabPercent}%)');
    expect(content).not.toContain('on accommodation');
  });

  it('payment-processing label replaces older "Service fee" / "Convenience fee" wording (TASK-2633)', () => {
    content = readFileSync(filePath, 'utf-8');
    // Honest label — "Payment processing" makes clear the 3% is a Razorpay pass-through, not an Atlas markup.
    expect(content).toContain('Payment processing');
    // Older labels must not appear as the primary user-visible label.
    expect(content).not.toContain('>Convenience fee');
    expect(content).not.toContain('Service fee');
  });

  it('has "You won\'t be charged yet" microcopy after Reserve', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain("bw-charge-note");
    expect(content).toContain("won");
    expect(content).toContain("charged yet");
  });

  it('has a computed-deadline trust strip (TASK-4334 — no hardcoded "48 hours")', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('bw-trust');
    expect(content).toContain('Select check-in dates to see your free cancellation deadline');
    // TASK-7012: the deadline sentence is built by the shared policy helper (which applies the
    // server's grace-void rule), not assembled here — so assert delegation, not a local template.
    expect(content).toContain('resolveFreeCancellationTrustCopy');
    expect(content).toContain('freeCancellationCopy?.trustMessage');
    // The old hardcoded claim must not reappear as a static string, and no window may be
    // recomputed inline from an hour literal.
    expect(content).not.toContain('Free cancellation until 48 hours before check-in');
    expect(content).not.toMatch(/48 \* 60 \* 60 \* 1000/);
    expect(content).not.toMatch(/(?:Free cancellation|cancellation deadline)[^\n]*\b48\b/);
  });

  it('gates the grace-window strip on the void-aware resolved hours, not the raw listing value (TASK-7012)', () => {
    content = readFileSync(filePath, 'utf-8');
    // The server VOIDS the universal grace window when check-in falls inside it from booking time.
    // Rendering the strip off `resolvedGraceHours` advertises a refund the API will not issue.
    expect(content).toContain('disclosableGraceHours');
    expect(content).toContain('applicableGraceHours');
    expect(content).toMatch(/\{disclosableGraceHours \?/);
    expect(content).not.toMatch(/\{resolvedGraceHours \?\s*\(/);
  });

  it('passes holdListingName to updateBooking in handleReserve', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('holdListingName');
    expect(content).toContain('listingName ?? null');
  });
});

describe('UnitBookingWidget - TASK-2630: URL date hydration and picker interaction', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
  let content: string;

  it('hydrates dateRange from BookingContext on mount', () => {
    content = readFileSync(filePath, 'utf-8');
    // Check hydration effect exists and reads from booking context
    expect(content).toContain('booking.checkIn');
    expect(content).toContain('booking.checkOut');
    expect(content).toContain('setDateRange');
    // Hydration should convert ISO strings to Date objects
    expect(content).toContain('getIstStartOfDay(new Date(ci))');
    expect(content).toContain('getIstStartOfDay(new Date(co))');
  });

  it('passes dateRange value to AtlasBookingCalendar as controlled value prop', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('value={dateRange}');
    expect(content).toContain('<AtlasBookingCalendar');
  });

  it('date row button has onClick handler that opens the calendar', () => {
    content = readFileSync(filePath, 'utf-8');
    // Button with id="unit-booking-dates" should have onClick that calls setOpenCalendar(true)
    expect(content).toContain('id="unit-booking-dates"');
    expect(content).toContain('setOpenCalendar(true)');
  });

  it('includes data-testid="price-line-base" on the base rate row for trip-wire testing', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('price-line-base');
  });
});

describe('UnitBookingWidget - TASK-4285: past-dated check-in from URL params is rejected', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
  let content: string;

  it('URL-param hydration guards against a past-dated check-in with an explicit error', () => {
    content = readFileSync(filePath, 'utf-8');
    // The hydration effect must compare the incoming check-in against today and, when it is in
    // the past, surface the guest-facing error instead of silently accepting the range.
    expect(content).toContain('start.getTime() < today.getTime()');
    expect(content).toContain('Check-in date must be today or in the future.');
  });

  it('invalidIstStayRange treats a past-dated check-in as invalid (disables Reserve + hides price)', () => {
    content = readFileSync(filePath, 'utf-8');
    // invalidIstStayRange is used both to disable the Reserve button and to hide the price
    // breakdown, so flagging a past check-in there covers the whole AC2 surface.
    expect(content).toContain('if (s < today.getTime()) return true;');
  });

  it('handleReserve refuses to create a hold for a past-dated check-in (defense-in-depth)', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('checkinIst.getTime() < today.getTime()');
  });
});

describe('UnitBookingWidget - TASK-2870: accommodation GST uses 18% slab above ₹7,500', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('uses shared guestPriceEstimate GST helpers (not retired 12% slab)', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('accommodationGstSlabPercent');
    expect(content).toContain('accommodationGstLineAmount');
    expect(content).not.toMatch(/<= 7500 \? 5 : 12/);
    expect(content).not.toContain('else 12%');
  });
});

describe('UnitBookingWidget - TASK-4322: global discount applied exactly once, no fake LOS row', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('no longer subtracts a second "losApplied"/losDiscountAmount from the taxable base', () => {
    const content = readFileSync(filePath, 'utf-8');
    // breakdownPrice (from selectedRangeTotalFromCalendar / effectiveDailyPricing.actualPrice)
    // is already discount-net server-side — taxableBase must equal it directly, not
    // breakdownPrice minus a second "losApplied" derived from the global discount.
    expect(content).not.toContain('losApplied');
    expect(content).not.toContain('losDiscountAmount');
    expect(content).not.toContain('losDiscountPercent');
    expect(content).toContain('const taxableBase = Math.max(0, breakdownPrice);');
  });

  it('no longer renders a "Long-stay discount" row (calendar DTO has no genuine LOS field)', () => {
    const content = readFileSync(filePath, 'utf-8');
    // The removed JSX row rendered the literal label text as a span child — assert that
    // specific rendered-text pattern is gone (code comments referencing the old row/task
    // for context are fine and expected to remain).
    expect(content).not.toMatch(/>\s*Long-stay discount/);
    // Leaves a pointer back to TASK-571 for when real LOS data becomes available.
    expect(content).toContain('TASK-571');
  });

  it('no longer imports/calls fetchPricingBreakdown (was only used to (mis)populate LOS state)', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('fetchPricingBreakdown');
  });
});

describe('UnitBookingWidget - TASK-4331: GST slab sourced from server, not a pre-adjustment client basis', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('fetches the server GST breakdown for the selected range', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('fetchGuestGstBreakdown');
    expect(content).toContain('serverGstPercent');
    expect(content).toContain('serverGstAmount');
    expect(content).toContain('serverFinalAmount');
  });

  it('gstSlabPercent prefers the server value when it matches the current selection', () => {
    const content = readFileSync(filePath, 'utf-8');
    // Must check serverGstMatchesSelection && serverGstPercent != null BEFORE falling back
    // to the client-derived accommodationGstSlabPercent(perNightForDisplay).
    expect(content).toMatch(
      /const gstSlabPercent =\s*\n\s*serverGstMatchesSelection && serverGstPercent != null/,
    );
    // Client-derived slab must remain as the fallback path (loading/offline UX), not removed.
    expect(content).toContain('accommodationGstSlabPercent(perNightForDisplay)');
  });

  it('gstLineAmount prefers the server-computed amount over recomputing from taxableBase', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toMatch(
      /const gstLineAmount =\s*\n\s*serverGstMatchesSelection && serverGstAmount != null/,
    );
  });

  it('finalTotal prefers server FinalAmount when it matches the current selection (TASK-5184)', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toMatch(
      /const finalTotal =\s*\n\s*serverGstMatchesSelection && typeof serverFinalAmount === 'number' && serverFinalAmount > 0/,
    );
  });
});

describe('UnitBookingWidget - TASK-4326: checkout-day off-by-one on back-to-back stays', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('disabledDay reuses doesRangeIntersectBlocked instead of only exempting startDate+1', () => {
    const content = readFileSync(filePath, 'utf-8');
    // Old rule: `const nextDay = addDays(dateRange.startDate, 1); if (normalized.getTime() === nextDay.getTime())`
    // — only ever exempted a 1-night stay. Must be gone from disabledDay.
    const disabledDaySection = content.slice(
      content.indexOf('const disabledDay = useCallback'),
      content.indexOf('}, [blockedSet, dateStatusMap, today, dateRange.startDate]);'),
    );
    expect(disabledDaySection).toContain('doesRangeIntersectBlocked');
    expect(disabledDaySection).not.toContain('const nextDay = addDays(dateRange.startDate, 1)');
  });

  it('still disables a blocked/hold date entirely when no startDate is selected (check-in gating unchanged)', () => {
    const content = readFileSync(filePath, 'utf-8');
    const disabledDaySection = content.slice(
      content.indexOf('const disabledDay = useCallback'),
      content.indexOf('}, [blockedSet, dateStatusMap, today, dateRange.startDate]);'),
    );
    // The checkout exemption is gated behind `dateRange.startDate &&` — without a startDate
    // selected, a blocked/hold candidate must fall through to `return true`.
    expect(disabledDaySection).toContain('if (dateRange.startDate &&');
  });
});

describe('UnitBookingWidget - TASK-4327: calendar reopen must not silently re-price a far-out selected range', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('merges fetched calendar pricing months instead of replacing the map wholesale', () => {
    const content = readFileSync(filePath, 'utf-8');
    // Old bug: a bare `setCalendarDailyPrices(result.dateToPrice)` replace wiped out any
    // previously-fetched far-out months on every effect re-fire. Assert the live call sites
    // merge via functional update; a code comment documenting the old bug may still mention
    // the literal old call, so match the specific `.then((result) => {` call-site pattern
    // rather than a bare substring check across the whole file.
    expect(content).toContain('setCalendarDailyPrices((prev) => new Map([...prev, ...result.dateToPrice]))');
    expect(content).not.toMatch(/\.then\(\(result\) => \{\s*\n\s*setCalendarDailyPrices\(result\.dateToPrice\)/);
  });

  it('does not clear calendarDailyPrices to an empty Map on a fetch failure', () => {
    const content = readFileSync(filePath, 'utf-8');
    // Old bug: `.catch(() => { setCalendarDailyPrices(new Map()); ... })` blanked the whole
    // map on any transient failure, including for months already successfully fetched.
    expect(content).not.toContain('setCalendarDailyPrices(new Map())');
  });

  it('fetches the selected range\'s own month(s) when the calendar opens, independent of shownMonthIso', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('selectedMonthIso === shownMonthIso');
    expect(content).toMatch(/useEffect\(\(\) => \{\s*\n\s*if \(!openCalendar\) return;/);
  });
});

describe('UnitBookingWidget - TASK-4293: Reserve button disabled when the selected check-in is unavailable', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('derives checkinUnavailable from the same Blocked/Hold/blockedSet check handleReserve uses', () => {
    const content = readFileSync(filePath, 'utf-8');
    const memoSection = content.slice(
      content.indexOf('const checkinUnavailable = useMemo('),
      content.indexOf('}, [dateRange.startDate, dateStatusMap, blockedSet]);'),
    );
    expect(memoSection).toBeTruthy();
    // Mirrors handleReserve's guard exactly so the button state can never disagree with the submit path.
    expect(memoSection).toContain("checkinStatus === 'Blocked' || checkinStatus === 'Hold' || blockedSet.has(checkinISO)");
    // Only needs a startDate — must NOT require endDate (blank dates stay clickable per TASK-4277).
    expect(memoSection).toContain('if (!dateRange.startDate) return false;');
  });

  it('wires checkinUnavailable into the Reserve button disabled condition', () => {
    const content = readFileSync(filePath, 'utf-8');
    const buttonSection = content.slice(
      content.indexOf('data-testid="guest-booking-submit"') - 900,
      content.indexOf('data-testid="guest-booking-submit"'),
    );
    expect(buttonSection).toContain('checkinUnavailable');
  });

  it('surfaces the unavailability reason proactively (disabled button cannot fire the click-time formError)', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('data-testid="guest-booking-checkin-unavailable"');
    expect(content).toContain('Check-in date is not available. Please select a different check-in date.');
  });

  it('re-hydrates URL dates after listingId resolves (listingId is a hydration dep)', () => {
    // PropertyDetails mounts with listingId=undefined then flips to the real id; the
    // listingId effect clears hasHydratedFromContextRef — listingId must be on the
    // hydration deps so ?checkIn=&checkOut= Blocked/Hold dates are re-applied (TASK-4293).
    const content = readFileSync(filePath, 'utf-8');
    const hydrateIdx = content.indexOf('Hydrate widget from booking context');
    expect(hydrateIdx).toBeGreaterThan(-1);
    const hydrateBlock = content.slice(hydrateIdx, hydrateIdx + 3200);
    expect(hydrateBlock).toMatch(/\}, \[booking\.checkIn, booking\.checkOut, today, listingId/);
  });

  it('does not silently auto-fill dateRange when today is Blocked/Hold (TASK-2629 cancellation-deadline)', () => {
    // Hosted-dev used to auto-select the next available night on load whenever today was
    // blocked, which pre-filled the trust strip with "Free cancellation until …" instead of
    // the fallback "Select check-in dates…" (guest-booking-cancellation-deadline:50).
    const content = readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/Auto-select next available date if today is blocked/);
    expect(content).not.toContain('hasAutoAdjustedRef');
  });
});

describe('UnitBookingWidget - TASK-4303: no provisional total before per-date pricing resolves (source)', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('derives rangePricingPending from per-night coverage and gates headline + breakdown behind it', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('const rangePricingPending =');
    expect(content).toContain('selectedRangeNightsPriced');
    // Headline and breakdown must render a skeleton — not the base-rate provisional — while pending.
    expect(content).toContain('data-testid="bw-price-pending"');
    expect(content).toContain('data-testid="bw-breakdown-pending"');
    expect(content).toContain('hasSelectedRange && !invalidIstStayRange && !rangePricingPending && (');
  });

  it('only a terminal (non-abort) pricing fetch failure degrades to the fallback estimate', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('calendarPricingFailed');
    expect(content).toContain("!== 'AbortError'");
  });

  it('Reserve is disabled while pricing is pending so the TASK-4286 client fallback cannot carry ₹0 fee forward', () => {
    const content = readFileSync(filePath, 'utf-8');
    const buttonSection = content.slice(
      content.indexOf('data-testid="guest-booking-submit"') - 1400,
      content.indexOf('data-testid="guest-booking-submit"'),
    );
    expect(buttonSection).toContain('rangePricingPending');
  });
});

describe('UnitBookingWidget - TASK-4303: first rendered Total equals the settled Total (render)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    task4303.booking.checkIn = null;
    task4303.booking.checkOut = null;
  });

  it('shows a skeleton (no Total) while pricing resolves, then the settled weekend total on first paint', async () => {
    // Weekend range at least a week out: Fri check-in → Sun check-out (2 weekend nights).
    const friday = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
    const sunday = addDays(friday, 2);
    const nightIsos = [toISODate(friday), toISODate(addDays(friday, 1))];
    task4303.booking.checkIn = toISODate(friday);
    task4303.booking.checkOut = toISODate(sunday);

    // Deferred per-date pricing: weekend uplift ₹6,500/night + 3% processing fee.
    let resolvePricing!: (r: { dateToPrice: Map<string, number>; convenienceFeePercent?: number }) => void;
    const pricingPromise = new Promise<{ dateToPrice: Map<string, number>; convenienceFeePercent?: number }>(
      (res) => { resolvePricing = res; },
    );
    task4303.fetchCalendarPricing.mockImplementation(() => pricingPromise);
    // Server GST for the range: 5% of ₹13,000 = ₹650.
    task4303.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 650, finalAmount: 14040 });

    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
        />
      </MemoryRouter>,
    );

    // While per-date pricing is unresolved: skeletons, and NO Total row / provisional numbers.
    await screen.findByTestId('bw-price-pending');
    expect(screen.getByTestId('bw-breakdown-pending')).toBeInTheDocument();
    expect(screen.queryByText('Total')).toBeNull();
    // The stale provisional numbers from the base rate (₹6,000 × 2 → ₹12,000 / ₹12,600) must never render.
    expect(screen.queryByText(/12,000/)).toBeNull();
    expect(screen.queryByText(/12,600/)).toBeNull();
    // Reserve is disabled while the quote is unresolved.
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();

    await act(async () => {
      resolvePricing({ dateToPrice: new Map(nightIsos.map((iso) => [iso, 6500])), convenienceFeePercent: 3 });
      await pricingPromise;
    });

    // Settled: base ₹6,500 × 2 = ₹13,000; GST 5% = ₹650; fee 3% × ₹13,000 = ₹390 (base only,
    // TASK-4913 founder-ruled 2026-07-17 option c); Total ₹14,040.
    const totalLabel = await screen.findByText('Total');
    const totalValue = totalLabel.parentElement?.querySelector('.lv-num')?.textContent ?? '';
    expect(totalValue.replace(/[^0-9]/g, '')).toBe('14040');
    // Headline total matches the breakdown total — the FIRST total ever rendered IS the settled one
    // (the queryByText('Total') assertion above proved nothing rendered earlier).
    expect(screen.getByTestId('bw-per-night-price').textContent?.replace(/[^0-9]/g, '')).toBe('14040');
    // Processing fee shows the real 3% amount, never a ₹0 placeholder.
    const feeRow = screen.getByTestId('bw-bd-service-fee-row');
    expect(feeRow.querySelector('.lv-num')?.textContent?.replace(/[^0-9]/g, '')).toBe('390');
    // Skeletons are gone.
    expect(screen.queryByTestId('bw-price-pending')).toBeNull();
    expect(screen.queryByTestId('bw-breakdown-pending')).toBeNull();
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
  });
});

describe('UnitBookingWidget - TASK-4830: availability fetch failure fail-closes Reserve (source)', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('tracks a terminal availability-fetch failure in an availabilityFailed flag', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('const [availabilityFailed, setAvailabilityFailed] = useState(false);');
    // Success path clears it; the catch sets it — but never for an AbortError (StrictMode/unmount).
    expect(content).toContain('setAvailabilityFailed(false)');
    expect(content).toContain('setAvailabilityFailed(true)');
    expect(content).toContain("error.name === 'AbortError'");
  });

  it('fail-closes the Reserve button on availability failure (a terminal error, not TASK-4277 loading)', () => {
    const content = readFileSync(filePath, 'utf-8');
    const buttonSection = content.slice(
      content.indexOf('data-testid="guest-booking-submit"') - 1800,
      content.indexOf('data-testid="guest-booking-submit"'),
    );
    expect(buttonSection).toContain('availabilityFailed ||');
  });

  it('offers a retry that clears the dedup key and re-issues the availability GET', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('data-testid="guest-booking-availability-error"');
    expect(content).toContain('data-testid="guest-booking-availability-retry"');
    expect(content).toContain('const handleAvailabilityRetry = useCallback(');
    const retrySection = content.slice(
      content.indexOf('const handleAvailabilityRetry = useCallback('),
      content.indexOf('const handleAvailabilityRetry = useCallback(') + 260,
    );
    expect(retrySection).toContain('lastAvailabilityKeyRef.current = null;');
    expect(retrySection).toContain('setAvailabilityRefreshNonce((n) => n + 1);');
  });

  it('handleReserve refuses to create a hold while availability is unconfirmed (defense-in-depth)', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/if \(availabilityFailed\) \{\s*\n\s*setFormError\(/);
  });
});

describe('UnitBookingWidget - TASK-4830: availability fetch failure fail-closes Reserve (render)', () => {
  beforeEach(() => {
    // Pricing effects must resolve (not throw) so the render focuses on availability behaviour.
    task4303.fetchCalendarPricing.mockResolvedValue({ dateToPrice: new Map(), convenienceFeePercent: 3 });
    task4303.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 0, finalAmount: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockImplementation(availabilityOk);
    task4303.booking.checkIn = null;
    task4303.booking.checkOut = null;
  });

  const renderWidget = async () => {
    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    return render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
        />
      </MemoryRouter>,
    );
  };

  it('disables Reserve and shows an error + retry when the availability GET returns 404', async () => {
    // 404 exercises the `!response.ok` throw path (a resolved-but-not-ok Response).
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockResolvedValue(new Response('Not found', { status: 404 }));

    await renderWidget();

    // Fail-closed: error surfaced, retry offered, Reserve disabled and labelled "Unavailable".
    await screen.findByTestId('guest-booking-availability-error');
    expect(screen.getByTestId('guest-booking-availability-retry')).toBeInTheDocument();
    const reserve = screen.getByTestId('guest-booking-submit');
    expect(reserve).toBeDisabled();
    expect(reserve.textContent).toContain('Unavailable');
  });

  it('re-enables Reserve after a successful retry (network failure → retry → 200 all-available)', async () => {
    availabilityMock.fetch.mockReset();
    // First GET fails at the network layer (CORS / Failed to fetch); the retry then succeeds.
    availabilityMock.fetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(availabilityOk);

    await renderWidget();

    const retry = await screen.findByTestId('guest-booking-availability-retry');
    expect(screen.getByTestId('guest-booking-submit')).toBeDisabled();

    await act(async () => {
      fireEvent.click(retry);
    });

    // After a successful retry the error clears and — with no blocking date selection — Reserve
    // is enabled again (blank dates stay clickable per TASK-4277; availabilityFailed was the only gate).
    await waitFor(() => {
      expect(screen.queryByTestId('guest-booking-availability-error')).toBeNull();
    });
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
  });
});

describe('UnitBookingWidget - TASK-4628: E13 overlap-block message must fire on remote dev, not just locally', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  const overlapHelper = () => {
    const content = readFileSync(filePath, 'utf-8');
    const start = content.indexOf('const checkInteriorNightOverlap =');
    expect(start, 'checkInteriorNightOverlap helper must exist').toBeGreaterThan(-1);
    // Slice to the end of the helper (its closing `};` before handleRangeChange).
    const end = content.indexOf('const handleRangeChange =', start);
    return content.slice(start, end);
  };

  it('re-normalizes the iteration cursor to IST start-of-day each step (matches doesRangeIntersectBlocked)', () => {
    const section = overlapHelper();
    // The canonical timezone-safe increment used across dateRange.ts. A bare `addDays(cursor, 1)`
    // preserves runtime-local wall-clock and can drift the iterated ISO off the IST calendar day
    // across a DST/offset boundary — the exact local-vs-remote-dev divergence in TASK-4628.
    expect(section).toContain('cursor = getIstStartOfDay(addDays(cursor, 1))');
    // The un-normalized form must NOT be the increment (only the guarded, normalized form).
    expect(section).not.toMatch(/cursor = addDays\(cursor, 1\);/);
  });

  it('checks both blockedSet and dateStatusMap Blocked/Hold — same sources the calendar renders .bc-unavail from', () => {
    const section = overlapHelper();
    expect(section).toContain("blockedSet.has(dayISO) || status === 'Blocked' || status === 'Hold'");
  });

  it('sanity: the normalized iterator visits every IST night in a multi-night range exactly once', () => {
    // Mirrors the helper's contract so the pattern the source-assert guards is proven correct,
    // independent of the runtime timezone (the same math checkInteriorNightOverlap relies on).
    const visit = (startDate: Date, endDate: Date): string[] => {
      const startIST = getIstStartOfDay(startDate);
      const endIST = getIstStartOfDay(endDate);
      const isos: string[] = [];
      let cursor = startIST;
      while (cursor.getTime() < endIST.getTime()) {
        isos.push(toISODate(cursor));
        cursor = getIstStartOfDay(addDays(cursor, 1));
      }
      return isos;
    };
    // 3-night range straddling a month boundary — the case the re-normalization protects.
    const nights = visit(new Date('2026-03-30T00:00:00Z'), new Date('2026-04-02T00:00:00Z'));
    expect(nights.length).toBeGreaterThanOrEqual(3);
    // No duplicates and strictly increasing — a drifting cursor would repeat or skip a day.
    expect(new Set(nights).size).toBe(nights.length);
    const sorted = [...nights].sort();
    expect(nights).toEqual(sorted);
  });
});

describe('UnitBookingWidget - TASK-4725: "Extra guest fee" row deleted (server never charges it)', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('no longer renders the phantom "Extra guest fee" breakdown row (source)', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('Extra guest fee');
    expect(content).not.toMatch(/priceDetails\.extraGuestsFee > 0 &&/);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    task4303.booking.checkIn = null;
    task4303.booking.checkOut = null;
    task4303.booking.guests = 2;
  });

  it('does not render "Extra guest fee" for a 3-guest booking even though the client-side fee would be > 0 (render)', async () => {
    // "Atlas 501 PH" infers unitType "1bhk" (name has no "penthouse" substring), whose
    // configured extraGuestFeeByUnitType is ₹500/night — guaranteed > 0 for 3 guests
    // (includedGuestsByUnitType["1bhk"] = 2), which is exactly the condition that used
    // to gate the deleted row on.
    const friday = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
    const sunday = addDays(friday, 2);
    task4303.booking.checkIn = toISODate(friday);
    task4303.booking.checkOut = toISODate(sunday);
    task4303.booking.guests = 3;

    task4303.fetchCalendarPricing.mockResolvedValue({
      dateToPrice: new Map([[toISODate(friday), 3500], [toISODate(addDays(friday, 1)), 3500]]),
      convenienceFeePercent: 3,
    });
    task4303.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 350, finalAmount: 7581 });

    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
        />
      </MemoryRouter>,
    );

    await screen.findByText('Total');
    expect(screen.queryByText('Extra guest fee')).toBeNull();
  });
});

describe('UnitBookingWidget - TASK-4726: URL-hydrated interior-night overlap disables Reserve even when the availability GET resolves after mount', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockImplementation(availabilityOk);
    task4303.booking.checkIn = null;
    task4303.booking.checkOut = null;
  });

  it('disables Reserve / shows a date error once availability data (loaded AFTER mount) reveals an interior booked night', async () => {
    // 3-night URL-hydrated range; only the MIDDLE night is booked — both edges are open, which
    // is exactly the shape TASK-4726 targets (distinct from a blocked check-in/check-out edge).
    const rangeStart = getIstStartOfDay(addDays(new Date(), 14));
    const middleNight = addDays(rangeStart, 1);
    const rangeEnd = addDays(rangeStart, 3);
    task4303.booking.checkIn = toISODate(rangeStart);
    task4303.booking.checkOut = toISODate(rangeEnd);

    // Every night of the range is REAL-priced so `selectedRangeNightsPriced`/`rangePricingPending`
    // never gate Reserve — isolating the assertion to the interior-night-overlap check itself,
    // not an unrelated pricing-pending disablement.
    const dateToPrice = new Map<string, number>([
      [toISODate(rangeStart), 5000],
      [toISODate(middleNight), 5000],
      [toISODate(addDays(rangeStart, 2)), 5000],
    ]);
    task4303.fetchCalendarPricing.mockResolvedValue({ dateToPrice, convenienceFeePercent: 3 });
    task4303.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 750, finalAmount: 15750 });

    // Defer the availability-calendar GET so the URL-hydration effect runs first (mount) against
    // empty blockedSet/dateStatusMap — reproducing the real page-load race — then resolve it with
    // the interior night marked Booked, simulating the fetch settling after mount.
    let resolveAvailability!: (r: Response) => void;
    const availabilityPromise = new Promise<Response>((res) => { resolveAvailability = res; });
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockImplementation(() => availabilityPromise);

    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
        />
      </MemoryRouter>,
    );

    // Before availability resolves: pricing has already settled for the full range, so Reserve
    // would be ENABLED here if not for the (still in-flight) availability check — proving that
    // once it later reveals the interior conflict, the disablement is genuinely attributable to
    // the interior-night-overlap logic and not some other unrelated gate.
    await waitFor(() => {
      expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
    });

    await act(async () => {
      resolveAvailability(
        new Response(
          JSON.stringify([{ date: toISODate(middleNight), status: 'Booked' }]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      await availabilityPromise;
    });

    // The regression: without the fix, the URL-hydration effect never re-runs after blockedSet/
    // dateStatusMap populate, so neither the date-error nor the disabled Reserve ever appear.
    await waitFor(() => {
      const dateError = screen.queryByTestId('guest-booking-date-error');
      const reserve = screen.getByTestId('guest-booking-submit');
      expect(Boolean(dateError) || reserve.hasAttribute('disabled')).toBe(true);
    });
  });
});

describe('UnitBookingWidget - TASK-4911: Reserve CTA surfaces inline validation instead of silently no-op-ing on incomplete dates', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockImplementation(availabilityOk);
    task4303.booking.checkIn = null;
    task4303.booking.checkOut = null;
  });

  const renderWidget = async () => {
    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    return render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
        />
      </MemoryRouter>,
    );
  };

  it('clicking Reserve with no dates selected shows "Add a check-in date to continue." and does not start checkout', async () => {
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });

    await renderWidget();

    const reserve = screen.getByTestId('guest-booking-submit');
    expect(reserve).toBeEnabled(); // TASK-4277: blank dates must not html-disable the CTA

    await act(async () => {
      fireEvent.click(reserve);
    });

    const error = await screen.findByTestId('guest-booking-date-error');
    expect(error.textContent).toContain('Add a check-in date to continue.');
    expect(error).toHaveAttribute('role', 'alert');

    // Silence, not just a blocked submit, was the bug — assert the checkout call never fired.
    expect(postSpy).not.toHaveBeenCalled();
    // Focus moves to the missing (check-in) field instead of leaving the guest stranded.
    expect(document.activeElement).toBe(document.getElementById('unit-booking-dates'));
  });

  it('clicking Reserve with only check-in selected shows "Add a check-out date to continue.", focuses check-out, and does not start checkout', async () => {
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} });

    await renderWidget();

    // AtlasBookingCalendar is mocked out for this render suite; the widget also listens for the
    // atlas:set-checkin window event (used by the bottom AvailabilityCalendar, TASK-2630) — the
    // only available hook here to land the widget in a check-in-only state for this assertion.
    const checkin = addDays(getIstStartOfDay(new Date()), 5);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('atlas:set-checkin', { detail: toISODate(checkin) }));
    });

    const reserve = screen.getByTestId('guest-booking-submit');
    expect(reserve).toBeEnabled();

    await act(async () => {
      fireEvent.click(reserve);
    });

    const error = await screen.findByTestId('guest-booking-date-error');
    expect(error.textContent).toContain('Add a check-out date to continue.');
    expect(error).toHaveAttribute('role', 'alert');

    expect(postSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId('unit-booking-checkout-cell'));
  });

  it('the check-in and check-out date cells are aria-described-by the inline error once shown', async () => {
    await renderWidget();

    const reserve = screen.getByTestId('guest-booking-submit');
    await act(async () => {
      fireEvent.click(reserve);
    });

    const error = await screen.findByTestId('guest-booking-date-error');
    const errorId = error.getAttribute('id');
    expect(errorId).toBeTruthy();
    expect(document.getElementById('unit-booking-dates')).toHaveAttribute('aria-describedby', errorId);
    expect(screen.getByTestId('unit-booking-checkout-cell')).toHaveAttribute('aria-describedby', errorId);
  });
});

describe('UnitBookingWidget - TASK-4910: no misleading GST-less total in incomplete date selection', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockImplementation(availabilityOk);
    task4303.booking.checkIn = null;
    task4303.booking.checkOut = null;
  });

  const renderWidget = async () => {
    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    return render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
        />
      </MemoryRouter>,
    );
  };

  it('check-in-only selection renders NO Total and no partial breakdown rows — only "Select dates to see total price"', async () => {
    task4303.fetchCalendarPricing.mockResolvedValue({ dateToPrice: new Map(), convenienceFeePercent: 3 });
    task4303.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 0, finalAmount: 0 });

    await renderWidget();

    // Land the widget in a check-in-only state (same technique as the TASK-4911 suite above —
    // AtlasBookingCalendar is mocked out, so the atlas:set-checkin window event is the only
    // available hook to select a check-in without a check-out).
    const checkin = addDays(getIstStartOfDay(new Date()), 5);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('atlas:set-checkin', { detail: toISODate(checkin) }));
    });

    // The card must still say "Select dates to see total price" ...
    expect(await screen.findByText('Select dates to see total price')).toBeInTheDocument();
    // ... and must NEVER show a concrete "Total" row, or any of the partial breakdown rows
    // (Accommodation + Payment processing summing to a total that silently omitted GST) that
    // the TASK-4910 repro captured alongside that same message.
    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByTestId('bw-bd-service-fee-row')).toBeNull();
    expect(screen.queryByTestId('bw-bd-gst-row')).toBeNull();
    expect(screen.queryByTestId('bw-bd-subtotal-row price-line-base')).toBeNull();
    expect(screen.queryByTestId('bw-bd-accommodation-subtotal')).toBeNull();
    expect(screen.queryByTestId('bw-breakdown-pending')).toBeNull();
    expect(screen.queryByTestId('bw-price-pending')).toBeNull();
  });

  it('a complete date range still renders the full breakdown, including the GST line, once selection is valid', async () => {
    // 1 night ₹6,000 → GST 5% = ₹300; processing fee 3% × 6,000 = ₹180 (base only, TASK-4913
    // founder-ruled 2026-07-17 option c); Total ₹6,480 — matches the TASK-4910 repro example
    // (30 Jun→01 Jul) updated to the base-only fee ruling.
    const checkin = addDays(getIstStartOfDay(new Date()), 5);
    const checkout = addDays(checkin, 1);
    const nightIso = toISODate(checkin);
    task4303.booking.checkIn = toISODate(checkin);
    task4303.booking.checkOut = toISODate(checkout);
    task4303.fetchCalendarPricing.mockResolvedValue({
      dateToPrice: new Map([[nightIso, 6000]]),
      convenienceFeePercent: 3,
    });
    task4303.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 300, finalAmount: 6480 });

    await renderWidget();

    const totalLabel = await screen.findByText('Total');
    const totalValue = totalLabel.parentElement?.querySelector('.lv-num')?.textContent ?? '';
    expect(totalValue.replace(/[^0-9]/g, '')).toBe('6480');

    const gstRow = screen.getByTestId('bw-bd-gst-row');
    expect(gstRow.textContent).toContain('GST (5%)');
    expect(gstRow.querySelector('.lv-num')?.textContent?.replace(/[^0-9]/g, '')).toBe('300');

    const feeRow = screen.getByTestId('bw-bd-service-fee-row');
    expect(feeRow.querySelector('.lv-num')?.textContent?.replace(/[^0-9]/g, '')).toBe('180');
  });
});

/**
 * TASK-7012 (render): the guest-visible cancellation copy must match the policy the API will
 * actually honour. `CancellationPolicyWindow` VOIDS the universal grace window when check-in falls
 * inside it from booking time, so a listing with graceHours set is NOT a guarantee this guest's
 * dates qualify. These assert the rendered DOM, not the source text.
 */
describe('UnitBookingWidget - TASK-7012: rendered cancellation copy matches the honoured policy', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockImplementation(availabilityOk);
    task4303.booking.checkIn = null;
    task4303.booking.checkOut = null;
  });

  // Policy passed as props so the widget short-circuits its listing fetch (TASK-5205).
  const renderWidget = async () => {
    const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
    return render(
      <MemoryRouter>
        <UnitBookingWidget
          listingId={7}
          propertyId={3}
          listingName="Atlas 501 PH"
          propertySlug="atlas501-ph"
          unitSlug="ph"
          minStayNights={1}
          cancellationTier="Strict"
          cancellationWindowHours={168}
          graceHours={24}
        />
      </MemoryRouter>,
    );
  };

  const setCheckin = async (daysOut: number) => {
    const checkin = addDays(getIstStartOfDay(new Date()), daysOut);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('atlas:set-checkin', { detail: toISODate(checkin) }));
    });
  };

  it('before any date is picked: prompts for dates and may show the generic grace disclosure', async () => {
    await renderWidget();
    const strip = await screen.findByTestId('bw-trust-strip-text');
    expect(strip.textContent).toContain('Select check-in dates');
    // Nothing to void against yet, so the listing-level disclosure is legitimate here.
    expect(screen.getByTestId('bw-grace-window-strip-text').textContent)
      .toContain('Free cancellation for 24 hours after you book');
  });

  it('far-out check-in: shows the computed deadline AND the grace disclosure (both true)', async () => {
    await renderWidget();
    await setCheckin(40);

    const strip = await screen.findByTestId('bw-trust-strip-text');
    // Strict = 168h before check-in, so ~33 days out — a real date, never "48 hours".
    expect(strip.textContent).toMatch(/^Free cancellation until \d{1,2}:\d{2} (?:AM|PM), \d{1,2} \w{3}$/);
    expect(strip.textContent).not.toContain('48');
    expect(screen.getByTestId('bw-grace-window-strip')).toBeInTheDocument();
  });

  it('same-day check-in (grace VOIDED, tier deadline lapsed): states the standard policy and hides the grace strip', async () => {
    await renderWidget();
    await setCheckin(0);

    const strip = await screen.findByTestId('bw-trust-strip-text');
    // The refund the server would actually issue here is nil — the copy must not promise otherwise.
    expect(strip.textContent).toBe('Standard cancellation policy applies for this stay.');
    expect(strip.textContent).not.toMatch(/free cancellation/i);
    // The grace window is voided for these dates, so advertising it would over-promise the refund.
    expect(screen.queryByTestId('bw-grace-window-strip')).toBeNull();
  });

  it('never renders an empty trust strip (a bare check icon with blank text)', async () => {
    await renderWidget();
    for (const daysOut of [0, 1, 40]) {
      await setCheckin(daysOut);
      const strip = screen.queryByTestId('bw-trust-strip-text');
      if (strip) {
        expect(strip.textContent?.trim(), `daysOut=${daysOut}`).not.toBe('');
      }
    }
  });
});
