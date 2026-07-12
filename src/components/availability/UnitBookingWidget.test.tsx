import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AxiosError } from 'axios';
import { act, cleanup, render, screen } from '@testing-library/react';
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
  dedupedAvailabilityCalendarFetch: async () =>
    new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
}));
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
    expect(content).toContain('Free cancellation until ${cancellationDeadlineText}');
    expect(content).toContain('Select check-in dates to see your free cancellation deadline');
    // The old hardcoded claim must not reappear as a static string.
    expect(content).not.toContain('Free cancellation until 48 hours before check-in');
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
    task4303.fetchGuestGstBreakdown.mockResolvedValue({ gstPercent: 5, gstAmount: 650, finalAmount: 14060 });

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

    // Settled: base ₹6,500 × 2 = ₹13,000; GST 5% = ₹650; fee 3% × ₹13,650 = ₹410; Total ₹14,060.
    const totalLabel = await screen.findByText('Total');
    const totalValue = totalLabel.parentElement?.querySelector('.lv-num')?.textContent ?? '';
    expect(totalValue.replace(/[^0-9]/g, '')).toBe('14060');
    // Headline total matches the breakdown total — the FIRST total ever rendered IS the settled one
    // (the queryByText('Total') assertion above proved nothing rendered earlier).
    expect(screen.getByTestId('bw-per-night-price').textContent?.replace(/[^0-9]/g, '')).toBe('14060');
    // Processing fee shows the real 3% amount, never a ₹0 placeholder.
    const feeRow = screen.getByTestId('bw-bd-service-fee-row');
    expect(feeRow.querySelector('.lv-num')?.textContent?.replace(/[^0-9]/g, '')).toBe('410');
    // Skeletons are gone.
    expect(screen.queryByTestId('bw-price-pending')).toBeNull();
    expect(screen.queryByTestId('bw-breakdown-pending')).toBeNull();
    expect(screen.getByTestId('guest-booking-submit')).toBeEnabled();
  });
});
