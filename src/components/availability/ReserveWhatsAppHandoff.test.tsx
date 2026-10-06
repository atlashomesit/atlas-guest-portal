import { afterEach, describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cleanup, render, screen } from '@testing-library/react';
import { ReserveWhatsAppHandoff } from './ReserveWhatsAppHandoff';
import { RESERVE_HANDOFF_COPY, buildReserveWhatsAppUrl } from './reserveHandoffLink';
import { isProviderNotConfiguredError } from './unitBookingPaymentOrderErrors';

// Pure-unit coverage for the Reserve 422 WhatsApp hand-off helpers. The behavioural proof (the widget
// actually renders the hand-off on the API's 422) is UnitBookingWidgetProviderNotConfiguredHandoff.test.tsx.

const failure = (status: number, data: unknown) => ({ response: { status, data } });

describe('isProviderNotConfiguredError - matches the API code on a 422, never a bare status', () => {
  it.each([
    ['422 PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT', failure(422, { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT' }), true],
    ['422 bare PAYMENT_PROVIDER_NOT_CONFIGURED', failure(422, { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' }), true],
    ['PascalCase Code tolerated', failure(422, { Code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT' }), true],
    ['padded code is trimmed', failure(422, { code: ' PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT ' }), true],
    ['503 ..._PLATFORM is a platform outage, not a hand-off', failure(503, { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_PLATFORM' }), false],
    ['422 ..._PLATFORM is not matched either', failure(422, { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_PLATFORM' }), false],
    ['422 PAYMENT_VALIDATION_ERROR', failure(422, { code: 'PAYMENT_VALIDATION_ERROR' }), false],
    ['422 INTERNAL_TENANT_PAYMENT_BLOCKED (error key, no code)', failure(422, { error: 'INTERNAL_TENANT_PAYMENT_BLOCKED' }), false],
    ['bare 422 with an empty body', failure(422, {}), false],
    ['bare 422 with a string body', failure(422, 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT'), false],
    ['bare 422 with a null body', failure(422, null), false],
    ['409 availability conflict', failure(409, { code: 'AVAILABILITY_CONFLICT' }), false],
    ['right code on the wrong status', failure(409, { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT' }), false],
    ['transport failure (no response)', new Error('Network Error'), false],
    ['null', null, false],
    ['undefined', undefined, false],
  ])('%s -> %s', (_label, error, expected) => {
    expect(isProviderNotConfiguredError(error)).toBe(expected);
  });
});

describe('buildReserveWhatsAppUrl', () => {
  const checkIn = new Date(2026, 9, 30); // Fri 30 Oct 2026, local-midnight calendar basis
  const checkOut = new Date(2026, 10, 2); // Mon 2 Nov 2026

  const textOf = (href: string) => new URL(href).searchParams.get('text');

  it('pre-fills the listing, the dates, the nights and the guest count the guest already chose', () => {
    const href = buildReserveWhatsAppUrl({
      phone: '919876543210',
      listingName: 'Coorg Cottage',
      checkIn,
      checkOut,
      guests: 4,
    });
    expect(href.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(textOf(href)).toBe(
      "Hi, I'm interested in booking Coorg Cottage for Fri, 30 Oct 2026 → Mon, 2 Nov 2026 (3 nights, 4 guests). Can you help me confirm?",
    );
  });

  it('uses singular night/guest wording', () => {
    const href = buildReserveWhatsAppUrl({
      phone: '919876543210',
      listingName: 'Coorg Cottage',
      checkIn,
      checkOut: new Date(2026, 9, 31),
      guests: 1,
    });
    expect(textOf(href)).toContain('(1 night, 1 guest)');
  });

  it('normalises a bare 10-digit national number to the international form wa.me needs (existing buildWaLink)', () => {
    const href = buildReserveWhatsAppUrl({ phone: '98765 43210', listingName: 'X', checkIn, checkOut, guests: 2 });
    expect(new URL(href).pathname).toBe('/919876543210');
  });

  it('strips punctuation from the host number', () => {
    const href = buildReserveWhatsAppUrl({ phone: '+91 98765-43210', listingName: 'X', checkIn, checkOut, guests: 2 });
    expect(new URL(href).pathname).toBe('/919876543210');
  });

  it.each([[undefined], [null], [''], ['   '], ['n/a']])(
    'returns "" (no link) when the host has no usable number: %j',
    (phone) => {
      expect(buildReserveWhatsAppUrl({ phone, listingName: 'X', checkIn, checkOut, guests: 2 })).toBe('');
    },
  );

  it('still produces a valid link when the dates were cleared after the error (message without a date clause)', () => {
    const href = buildReserveWhatsAppUrl({ phone: '919876543210', listingName: 'Coorg Cottage', guests: 2 });
    expect(textOf(href)).toBe("Hi, I'm interested in booking Coorg Cottage. Can you help me confirm?");
  });

  it('falls back to a neutral property name and a guest count of at least 1', () => {
    const href = buildReserveWhatsAppUrl({ phone: '919876543210', listingName: '  ', checkIn, checkOut, guests: 0 });
    expect(textOf(href)).toContain('booking your property for');
    expect(textOf(href)).toContain('1 guest)');
  });
});

describe('ReserveWhatsAppHandoff (presentational)', () => {
  afterEach(cleanup);

  it('with a link: message, WhatsApp CTA and reassurance; the CTA opens safely in a new tab', () => {
    render(<ReserveWhatsAppHandoff href="https://wa.me/919876543210?text=hi" />);
    const box = screen.getByTestId('reserve-whatsapp-handoff');
    expect(box).toHaveAttribute('role', 'alert');
    expect(box).toHaveTextContent(RESERVE_HANDOFF_COPY.title);
    expect(box).toHaveTextContent(RESERVE_HANDOFF_COPY.withHostNumber);
    expect(box).toHaveTextContent(RESERVE_HANDOFF_COPY.reassurance);
    const cta = screen.getByTestId('reserve-whatsapp-handoff-cta');
    expect(cta).toHaveAttribute('href', 'https://wa.me/919876543210?text=hi');
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta).toHaveAttribute('rel', 'noopener noreferrer');
    expect(cta).toHaveTextContent(RESERVE_HANDOFF_COPY.cta);
  });

  it('without a link: message only - no anchor at all, so no recipient-less wa.me URL can ever render', () => {
    render(<ReserveWhatsAppHandoff href="" />);
    const box = screen.getByTestId('reserve-whatsapp-handoff');
    expect(box).toHaveTextContent(RESERVE_HANDOFF_COPY.title);
    expect(box).toHaveTextContent(RESERVE_HANDOFF_COPY.withoutHostNumber);
    expect(box.querySelector('a')).toBeNull();
    expect(screen.queryByTestId('reserve-whatsapp-handoff-cta')).toBeNull();
    expect(box).not.toHaveTextContent(RESERVE_HANDOFF_COPY.reassurance);
  });
});

describe('RESERVE_HANDOFF_COPY stays pinned to the sentences it reuses (drift guard)', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf-8');

  it('mirrors the GuestDetailsPage offline-branch copy (TASK-8048)', () => {
    const details = read('../../pages/booking/GuestDetailsPage.tsx');
    expect(details).toContain(RESERVE_HANDOFF_COPY.title);
    expect(details).toContain(RESERVE_HANDOFF_COPY.cta);
    expect(details).toContain(RESERVE_HANDOFF_COPY.reassurance);
    // The widget sentence is the details-page sentence minus its "— your hold is reserved for {countdown}"
    // clause: there is no hold at the Reserve step, so claiming one would be false.
    expect(details).toContain(
      `${RESERVE_HANDOFF_COPY.withHostNumber.slice(0, -1)} — your hold is reserved for`,
    );
  });

  it('mirrors the widget\'s existing "Bookings opening soon" banner sentence', () => {
    expect(read('./UnitBookingWidget.tsx')).toContain(RESERVE_HANDOFF_COPY.withoutHostNumber);
  });

  it('the widget renders the hand-off component and matches the 422 by API code (not a bare status)', () => {
    const widget = read('./UnitBookingWidget.tsx');
    expect(widget).toContain('<ReserveWhatsAppHandoff');
    expect(widget).toContain('isProviderNotConfiguredError(error)');
    expect(widget).toContain('buildReserveWhatsAppUrl');
  });
});
