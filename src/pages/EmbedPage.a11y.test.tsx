/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addDays, format } from 'date-fns';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getIstCalendarDate } from '@/utils/date';
import EmbedPage, { readableCtaText, DateGuestPicker } from './EmbedPage';

vi.mock('@/runtime-config', () => ({ getApiBaseUrl: () => 'https://api.example.test' }));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));
vi.mock('@/api/pricingClient', () => ({
  fetchGuestPriceBreakdown: async () => ({
    finalAmount: 5000,
    convenienceFeeAmount: 0,
    gstAmount: 0,
    gstPercent: 0,
    touristTaxAmount: 0,
  }),
  netChargeableRoomFare: () => 5000,
}));

const renderEmbed = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/embed/:embedKey" element={<EmbedPage />} /></Routes>
  </MemoryRouter>,
);

const singleListingConfig = JSON.stringify({
  tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
  isLiveEligible: true, publishedListingsCount: 1,
  listings: [{ id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House', maxGuests: 4, baseNightlyRate: 5000 }],
});

const twoListingConfig = JSON.stringify({
  tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
  isLiveEligible: true, publishedListingsCount: 2,
  listings: [
    { id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House', maxGuests: 4, baseNightlyRate: 5000 },
    { id: 2, name: 'Loft', propertyId: 1, propertyName: 'Beach House', maxGuests: 2, baseNightlyRate: 6000 },
  ],
});

// Stubs `fetch` to route the embed config request and the availability-calendar request to
// different canned responses/behaviour, keyed off the request URL -- both land on the global
// `fetch` EmbedPage.tsx calls directly (see fetchAvailability).
function stubEmbedFetch(availability: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/availability-calendar')) return availability(url);
    return new Response(singleListingConfig, { status: 200 });
  }));
}

describe('EmbedPage state semantics', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('announces loading state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderEmbed('/embed/demo');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('announces API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));
    renderEmbed('/embed/failing');
    expect(await screen.findByRole('alert')).toHaveTextContent('Booking widget unavailable');
  });

  it('shows not-eligible state when isLiveEligible is false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
      isLiveEligible: false, publishedListingsCount: 0, listings: [],
    }), { status: 200 })));
    renderEmbed('/embed/demo');
    expect(await screen.findByTestId('embed-not-eligible')).toBeInTheDocument();
  });

  it('shows no-listings state when listings array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
      isLiveEligible: true, publishedListingsCount: 0, listings: [],
    }), { status: 200 })));
    renderEmbed('/embed/demo');
    expect(await screen.findByTestId('embed-no-listings')).toBeInTheDocument();
  });

  it('auto-selects single listing and shows date picker', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
      isLiveEligible: true, publishedListingsCount: 1,
      listings: [{ id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House', maxGuests: 4, baseNightlyRate: 5000 }],
    }), { status: 200 })));
    renderEmbed('/embed/demo');
    expect(await screen.findByTestId('embed-date-guest')).toBeInTheDocument();
  });

  it('chooses a readable CTA label for light and dark tenant colors', () => {
    expect(readableCtaText('#ffffff')).toBe('#111827');
    expect(readableCtaText('#fff')).toBe('#111827');
    expect(readableCtaText('#0f766e')).toBe('#ffffff');
  });

  // TASK-10168 defect 1: fetchAvailability's resolved Map used to be discarded entirely, so
  // every date in the year was selectable regardless of occupancy.
  it('does not allow submitting a Blocked night', async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2); // a single night: checkIn itself
    const blockedNight = format(checkIn, 'yyyy-MM-dd');

    stubEmbedFetch(async () => new Response(
      JSON.stringify([{ date: blockedNight, status: 'Blocked' }]),
      { status: 200 },
    ));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-date-guest');

    fireEvent.change(screen.getByTestId('embed-checkin-date'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByTestId('embed-checkout-date'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });

    // findByRole waits out the "Checking availability..." loading label first, so this only
    // passes once the fetch has actually resolved and the range has actually been evaluated --
    // not merely because the button happened to be disabled while still loading.
    const cta = await screen.findByRole('button', { name: 'Check pricing' });
    expect(cta).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/selected nights/);
  });

  // TASK-10179: a single-occupancy listing's guest count used to default to a bare
  // `useState(2)`, which is not one of the select's own options when maxGuests is 1 -- no
  // onChange ever fires to correct a value the UI can't even display, so the submitted guest
  // count stayed 2 and the server rejected the booking as guests > listing.maxGuests.
  it("clamps the initial guest count into the select's own option set when maxGuests is 1", async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2);
    stubEmbedFetch(async () => new Response(
      JSON.stringify([{ date: format(checkIn, 'yyyy-MM-dd'), status: 'Available' }]),
      { status: 200 },
    ));

    const onConfirm = vi.fn();
    render(
      <DateGuestPicker
        listing={{
          id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House',
          maxGuests: 1, baseNightlyRate: 5000, coverPhotoUrl: null,
          checkInTime: null, checkOutTime: null, timezoneId: null, securityDepositAmount: null,
        }}
        brand="#0f766e"
        onConfirm={onConfirm}
      />,
    );

    // The bound value must already agree with the only option the select can display --
    // asserted before any interaction, since the original bug never needed a click to exist.
    const guestsSelect = screen.getByLabelText('Guests') as HTMLSelectElement;
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(guestsSelect.value).toBe('1');

    fireEvent.change(screen.getByTestId('embed-checkin-date'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByTestId('embed-checkout-date'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check pricing' }));

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 1);
  });

  // TASK-10179 (related): `Number(r.maxGuests ?? r.MaxGuests ?? 2)` lets an API-supplied
  // literal 0 straight through (`??` only catches null/undefined), which used to produce a
  // ZERO-option select with the guest state still stuck at 2 -- no control at all.
  it('falls back to a single selectable guest option when maxGuests is 0', async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2);
    stubEmbedFetch(async () => new Response(
      JSON.stringify([{ date: format(checkIn, 'yyyy-MM-dd'), status: 'Available' }]),
      { status: 200 },
    ));

    const onConfirm = vi.fn();
    render(
      <DateGuestPicker
        listing={{
          id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House',
          maxGuests: 0, baseNightlyRate: 5000, coverPhotoUrl: null,
          checkInTime: null, checkOutTime: null, timezoneId: null, securityDepositAmount: null,
        }}
        brand="#0f766e"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect((screen.getByLabelText('Guests') as HTMLSelectElement).value).toBe('1');

    fireEvent.change(screen.getByTestId('embed-checkin-date'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByTestId('embed-checkout-date'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check pricing' }));

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 1);
  });

  // TASK-10168 defect 2: fetchAvailability's own fetch has no .catch, so a rejected promise
  // (DNS/offline/CORS/abort) left `loadingAvail` stuck true and "Check pricing" disabled forever.
  it('leaves the CTA enabled with a retry affordance when the availability fetch fails', async () => {
    let availabilityCalls = 0;
    stubEmbedFetch(async () => { availabilityCalls += 1; throw new TypeError('Failed to fetch'); });

    renderEmbed('/embed/demo');
    const cta = await screen.findByRole('button', { name: 'Retry availability check' });
    expect(cta).not.toBeDisabled();
    expect(availabilityCalls).toBe(1);

    fireEvent.click(cta);
    await waitFor(() => expect(availabilityCalls).toBe(2));
  });

  it('exposes accessible names for date, guest and contact controls', async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2);
    stubEmbedFetch(async () => new Response(
      JSON.stringify([{ date: format(checkIn, 'yyyy-MM-dd'), status: 'Available' }]),
      { status: 200 },
    ));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-date-guest');
    expect(screen.getByLabelText('Check-in')).toBeInTheDocument();
    expect(screen.getByLabelText('Check-out')).toBeInTheDocument();
    expect(screen.getByLabelText('Guests')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check pricing' }));

    await screen.findByTestId('embed-guest-details');
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument();
  });

  it('does not send guestConsentAccepted true unless the DPDP control is checked', async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2);
    const chargeBodies: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/availability-calendar')) {
        return new Response(JSON.stringify([{ date: format(checkIn, 'yyyy-MM-dd'), status: 'Available' }]), { status: 200 });
      }
      if (typeof url === 'string' && url.includes('/api/Razorpay/order')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        if (body.holdId) chargeBodies.push(body);
        return new Response(JSON.stringify({
          holdId: 1, holdExpiresAt: '2099-01-01', prepToken: 't',
          keyId: 'k', orderId: 'o', amount: 100, currency: 'INR', bookingId: 1, bookingToken: null,
        }), { status: 200 });
      }
      return new Response(singleListingConfig, { status: 200 });
    }));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-date-guest');
    fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check pricing' }));
    await screen.findByTestId('embed-guest-details');

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ada Guest' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.test' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '9999999999' } });

    expect(screen.getByTestId('embed-dpdp-consent')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Pay & book' })).toBeDisabled();

    fireEvent.click(screen.getByTestId('embed-dpdp-consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Pay & book' }));
    await waitFor(() => expect(chargeBodies.length).toBeGreaterThan(0));
    expect(chargeBodies[0]).toEqual(expect.objectContaining({ guestConsentAccepted: true }));
  });

  // TASK-10178 part 1: on select -> dates -> details -> confirmed, the previous step used to
  // unmount with nothing announced -- the file's only live region (pre-config loading) is
  // long gone by then. The persistent status region's TEXT must actually change on each
  // transition, which is what makes assistive tech announce it (a newly-mounted role="status"
  // element is less reliable than one whose content changes in place).
  it('announces the select -> dates step transition in the status region', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(twoListingConfig, { status: 200 })));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-listing-select');
    expect(screen.getByRole('status')).toHaveTextContent(/choose a stay/i);

    fireEvent.click(screen.getByRole('button', { name: /Studio/ }));

    await screen.findByTestId('embed-date-guest');
    expect(screen.getByRole('status')).toHaveTextContent(/dates and number of guests/i);
  });

  it('announces dates -> details -> confirmed step transitions in the status region', async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2);

    class RazorpayMock {
      private handler: (resp: unknown) => void;
      constructor(opts: { handler: (resp: unknown) => void }) { this.handler = opts.handler; }
      open() { this.handler({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig_1' }); }
      on() { /* noop */ }
    }
    vi.stubGlobal('Razorpay', RazorpayMock);

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/availability-calendar')) {
        return new Response(JSON.stringify([{ date: format(checkIn, 'yyyy-MM-dd'), status: 'Available' }]), { status: 200 });
      }
      if (url.includes('/api/Razorpay/verify')) return new Response(JSON.stringify({}), { status: 200 });
      if (url.includes('/api/Razorpay/order')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        if (body.holdId) {
          return new Response(JSON.stringify({
            keyId: 'k', orderId: 'o', amount: 100, currency: 'INR', bookingId: 42, bookingToken: null,
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ holdId: 1, holdExpiresAt: '2099-01-01', prepToken: 't' }), { status: 200 });
      }
      return new Response(singleListingConfig, { status: 200 });
    }));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-date-guest');
    expect(screen.getByRole('status')).toHaveTextContent(/dates and number of guests/i);

    fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check pricing' }));

    await screen.findByTestId('embed-guest-details');
    expect(screen.getByRole('status')).toHaveTextContent(/enter your details/i);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ada Guest' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.test' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '9999999999' } });
    fireEvent.click(screen.getByTestId('embed-dpdp-consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Pay & book' }));

    // "Booking confirmed!" is a plain <h3> with nothing announcing it -- the same status
    // region must pick up the confirmation too.
    await screen.findByTestId('embed-confirmed');
    expect(screen.getByRole('status')).toHaveTextContent(/booking confirmed/i);
  });

  // TASK-10180 defect 1: ConfirmationView took `bookingToken` (and `brand`) as props but
  // referenced neither -- the guest saw "Booking #N" and nothing else. Inside a 600px iframe on
  // a stranger's website there is no other route back to the reservation once the widget
  // unmounts, so the link must carry the token and escape the frame rather than navigate it.
  it('links the confirmation to the booking with its token, opening in a new tab', async () => {
    const today = getIstCalendarDate();
    const checkIn = addDays(today, 1);
    const checkOut = addDays(today, 2);

    class RazorpayMock {
      private handler: (resp: unknown) => void;
      constructor(opts: { handler: (resp: unknown) => void }) { this.handler = opts.handler; }
      open() { this.handler({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig_1' }); }
      on() { /* noop */ }
    }
    vi.stubGlobal('Razorpay', RazorpayMock);

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/availability-calendar')) {
        return new Response(JSON.stringify([{ date: format(checkIn, 'yyyy-MM-dd'), status: 'Available' }]), { status: 200 });
      }
      if (url.includes('/api/Razorpay/verify')) return new Response(JSON.stringify({}), { status: 200 });
      if (url.includes('/api/Razorpay/order')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        if (body.holdId) {
          return new Response(JSON.stringify({
            keyId: 'k', orderId: 'o', amount: 100, currency: 'INR', bookingId: 42, bookingToken: 'tok_abc123',
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ holdId: 1, holdExpiresAt: '2099-01-01', prepToken: 't' }), { status: 200 });
      }
      return new Response(singleListingConfig, { status: 200 });
    }));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-date-guest');
    fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: format(checkIn, 'yyyy-MM-dd') } });
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: format(checkOut, 'yyyy-MM-dd') } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check pricing' }));

    await screen.findByTestId('embed-guest-details');
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ada Guest' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.test' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '9999999999' } });
    fireEvent.click(screen.getByTestId('embed-dpdp-consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Pay & book' }));

    await screen.findByTestId('embed-confirmed');
    const link = await screen.findByRole('link', { name: /view or manage your booking/i });
    expect(link).toHaveAttribute('href', `${window.location.origin}/booking/42?t=tok_abc123`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // TASK-10180 defect 2: the guard `r.baseNightlyRate != null ? Number(r.baseNightlyRate ??
  // r.BaseNightlyRate) : null` tested only the camelCase key, so a PascalCase-only payload
  // short-circuited to null and the "/night" line silently vanished -- even though the ?? inside
  // Number(...) would have read the PascalCase value just fine.
  it('shows the nightly rate when the API sends only PascalCase BaseNightlyRate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      tenantId: 1, tenantSlug: 'test', tenantName: 'Test',
      isLiveEligible: true, publishedListingsCount: 2,
      listings: [
        { id: 1, name: 'Studio', propertyId: 1, propertyName: 'Beach House', maxGuests: 4, BaseNightlyRate: 5000 },
        { id: 2, name: 'Loft', propertyId: 1, propertyName: 'Beach House', maxGuests: 2, BaseNightlyRate: 6000 },
      ],
    }), { status: 200 })));

    renderEmbed('/embed/demo');
    await screen.findByTestId('embed-listing-select');
    expect(screen.getByText(/5,000\/night/)).toBeInTheDocument();
  });
});
