/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SecurityDepositPage from './SecurityDepositPage';
import { settle } from '../test/settle';

vi.mock('../api/client', () => ({
  buildApiUrl: (path: string) => `https://api.example.test${path}`,
  getApiHeaders: () => ({}),
}));

const fetchListingByIdMock = vi.fn();
vi.mock('../api/listingClient', () => ({
  fetchListingById: (...args: unknown[]) => fetchListingByIdMock(...args),
}));

const summary = {
  bookingId: 42,
  listingId: 9,
  guestName: 'Asha Guest',
  guestPhone: '9876543210',
  propertyName: 'Villa Azure',
  listingName: 'Sea View Suite',
  checkinDate: '2026-11-10',
  checkoutDate: '2026-11-12',
  status: 'Confirmed',
};

const order = { depositHoldId: 7, razorpayOrderId: 'order_TEST1', razorpayKeyId: 'FAKE_KEY_ID_ONE', amountPaise: 500000, currency: 'INR' };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  method?: Record<string, boolean>;
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
};

let lastOptions: RazorpayOptions | null = null;
let openSpy: ReturnType<typeof vi.fn>;
let failedHandler: (() => void) | null = null;

class FakeRazorpay {
  constructor(options: RazorpayOptions) {
    lastOptions = options;
  }

  open = () => openSpy();

  on = (event: string, handler: () => void) => {
    if (event === 'payment.failed') failedHandler = handler;
  };
}

const renderPage = (path = '/booking/42/deposit?t=NONCE-1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/booking/:bookingId/deposit" element={<SecurityDepositPage />} />
        <Route path="/booking/:bookingId" element={<p>booking page</p>} />
      </Routes>
    </MemoryRouter>,
  );

type Call = { url: string; method: string; body?: unknown };
let calls: Call[] = [];

function stubApi(handlers: { order?: () => Response; verify?: () => Response; summary?: () => Response } = {}) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes('/summary')) return handlers.summary ? handlers.summary() : json(summary);
      if (url.includes('/deposit-holds/public-order/')) return handlers.order ? handlers.order() : json(order);
      if (url.includes('/deposit-holds/public-verify/')) {
        return handlers.verify ? handlers.verify() : json({ depositHoldId: 7, status: 'Authorized', amountInr: 5000 });
      }
      return new Response('not found', { status: 404 });
    }),
  );
}

describe('SecurityDepositPage (TASK-10299239)', () => {
  beforeEach(() => {
    lastOptions = null;
    failedHandler = null;
    openSpy = vi.fn();
    fetchListingByIdMock.mockReset();
    fetchListingByIdMock.mockResolvedValue({ id: 9, securityDepositAmount: 5000, securityDepositCollectionMethod: 'Online' });
    (window as unknown as { Razorpay: unknown }).Razorpay = FakeRazorpay;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as { Razorpay?: unknown }).Razorpay;
  });

  it('shows the stay and the deposit amount, and explains it is a hold, not a charge', async () => {
    stubApi();
    renderPage();
    await settle();

    expect(screen.getByTestId('deposit-stay')).toHaveTextContent('Villa Azure');
    expect(screen.getByTestId('deposit-stay')).toHaveTextContent('Sea View Suite');
    expect(screen.getByTestId('deposit-amount')).toHaveTextContent('₹5,000');
    expect(screen.getByText(/hold on your card, not a charge/i)).toBeInTheDocument();
    expect(screen.getByTestId('deposit-pay')).toBeEnabled();
    // Nothing is created just by looking at the page.
    expect(calls.filter((c) => c.url.includes('/deposit-holds/'))).toHaveLength(0);
    // The summary is read with the booking-link token.
    expect(calls[0].url).toBe('https://api.example.test/api/guest/bookings/42/summary?t=NONCE-1');
  });

  // PAY-028 (guest half): no "released after check-out" promise on the pay screen; it says what the hold covers and how it ends.
  it('before paying, says the hold covers damage claims for a while and that the bank frees it afterwards (no release-after-check-out promise)', async () => {
    stubApi();
    renderPage();
    await settle();

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/hold on your card, not a charge/i);
    expect(text).toContain('covers damage claims for about 3 nights from the day before check-in');
    expect(text).toContain('your bank frees it. Your bank may take a few more days to show it.');
    expect(text).not.toMatch(/released after check-?out|The rest is released/i);
  });

  it('after the hold is placed, names the date the hold covers damage claims until when the API sends it', async () => {
    stubApi({ verify: () => json({ depositHoldId: 7, status: 'Authorized', amountInr: 5000, coversUntilUtc: '2026-11-14T08:30:00Z' }) });
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('deposit-pay'));
    await settle();
    lastOptions!.handler({ razorpay_payment_id: 'pay_TEST1', razorpay_order_id: 'order_TEST1', razorpay_signature: 'sig_TEST1' });
    await settle();

    const done = screen.getByTestId('deposit-done');
    expect(done).toHaveTextContent(/hold of ₹5,000 is in place/i);
    expect(done).toHaveTextContent(/It covers damage claims until 14 Nov 2026/);
    expect(done).toHaveTextContent('After that, or when your host releases it, your bank frees it; your bank may take a few more days to show it.');
    expect(done.textContent).not.toMatch(/released after check-?out/i);
  });

  it('after the hold is placed with no date from the API, says it covers damage claims while it lasts', async () => {
    stubApi();
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('deposit-pay'));
    await settle();
    lastOptions!.handler({ razorpay_payment_id: 'pay_TEST1', razorpay_order_id: 'order_TEST1', razorpay_signature: 'sig_TEST1' });
    await settle();

    const done = screen.getByTestId('deposit-done');
    expect(done).toHaveTextContent('It covers damage claims while it lasts.');
    expect(done.textContent).not.toMatch(/until \d|released after check-?out/i);
  });

  it('creates the order through public-order, opens Razorpay Checkout limited to cards, then verifies through public-verify', async () => {
    stubApi();
    renderPage();
    await settle();

    fireEvent.click(screen.getByTestId('deposit-pay'));
    await settle();

    const orderCall = calls.find((c) => c.url.includes('/deposit-holds/public-order/'));
    expect(orderCall).toMatchObject({ method: 'POST', url: 'https://api.example.test/api/deposit-holds/public-order/42?t=NONCE-1' });

    // Checkout is opened with the server's order, the server's amount in paise, and cards only (only a card can be held).
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(lastOptions).toMatchObject({ key: 'FAKE_KEY_ID_ONE', order_id: 'order_TEST1', amount: 500000, currency: 'INR' });
    expect(lastOptions?.method).toEqual({ card: true, upi: false, netbanking: false, wallet: false, emi: false, paylater: false });

    // Checkout's callback goes to public-verify with the hold id.
    lastOptions!.handler({ razorpay_payment_id: 'pay_TEST1', razorpay_order_id: 'order_TEST1', razorpay_signature: 'sig_TEST1' });
    await settle();

    const verifyCall = calls.find((c) => c.url.includes('/deposit-holds/public-verify/'));
    expect(verifyCall).toMatchObject({ method: 'POST', url: 'https://api.example.test/api/deposit-holds/public-verify/42?t=NONCE-1' });
    expect(verifyCall?.body).toEqual({
      depositHoldId: 7,
      razorpayOrderId: 'order_TEST1',
      razorpayPaymentId: 'pay_TEST1',
      razorpaySignature: 'sig_TEST1',
    });
    expect(screen.getByTestId('deposit-done')).toHaveTextContent(/hold of ₹5,000 is in place/i);
    expect(screen.queryByTestId('deposit-pay')).not.toBeInTheDocument();
  });

  it('says nothing was charged when the guest closes the payment window', async () => {
    stubApi();
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('deposit-pay'));
    await settle();

    lastOptions!.modal!.ondismiss!();
    await settle();

    expect(screen.getByTestId('deposit-notice')).toHaveTextContent(/not been charged/i);
    expect(screen.getByTestId('deposit-pay')).toBeEnabled();
    expect(calls.some((c) => c.url.includes('/public-verify/'))).toBe(false);
  });

  it('keeps the Pay button as the retry control after a failed card', async () => {
    stubApi();
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('deposit-pay'));
    await settle();

    failedHandler!();
    await settle();

    expect(screen.getByTestId('deposit-error')).toHaveTextContent(/could not be held/i);
    expect(screen.getByTestId('deposit-pay')).toBeEnabled();
  });

  it('does not show success when verification is refused', async () => {
    stubApi({ verify: () => json({ message: 'Verification failed.' }, 400) });
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('deposit-pay'));
    await settle();
    lastOptions!.handler({ razorpay_payment_id: 'pay_TEST1', razorpay_order_id: 'order_TEST1', razorpay_signature: 'bad' });
    await settle();

    expect(screen.queryByTestId('deposit-done')).not.toBeInTheDocument();
    expect(screen.getByTestId('deposit-error')).toHaveTextContent(/not been charged/i);
    expect(screen.getByTestId('deposit-pay')).toBeEnabled();
  });

  it('shows "already in place" when the API says a hold exists (409 with a hold status)', async () => {
    stubApi({ order: () => json({ message: 'A security deposit hold is already in place for this booking.', status: 'Authorized' }, 409) });
    renderPage();
    await settle();
    fireEvent.click(screen.getByTestId('deposit-pay'));
    await settle();

    expect(screen.getByTestId('deposit-done')).toHaveTextContent(/already in place/i);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('shows nothing to pay when the host collects the deposit in person (and never offers Pay)', async () => {
    fetchListingByIdMock.mockResolvedValue({ id: 9, securityDepositAmount: 5000, securityDepositCollectionMethod: 'AtProperty' });
    stubApi();
    renderPage();
    await settle();

    expect(screen.getByTestId('deposit-error')).toHaveTextContent(/collects the security deposit in person/i);
    expect(screen.queryByTestId('deposit-pay')).not.toBeInTheDocument();
  });

  it('shows nothing to pay when no deposit is configured', async () => {
    fetchListingByIdMock.mockResolvedValue({ id: 9, securityDepositAmount: 0, securityDepositCollectionMethod: 'Online' });
    stubApi();
    renderPage();
    await settle();

    expect(screen.getByTestId('deposit-error')).toHaveTextContent(/no security deposit is needed/i);
    expect(screen.queryByTestId('deposit-pay')).not.toBeInTheDocument();
  });

  it('still offers Pay when the listing amount cannot be read (the API stays the authority)', async () => {
    fetchListingByIdMock.mockRejectedValue(new Error('network'));
    stubApi();
    renderPage();
    await settle();

    expect(screen.getByTestId('deposit-pay')).toBeEnabled();
    expect(screen.queryByTestId('deposit-amount')).not.toBeInTheDocument();
  });

  it('refuses a booking that is not a live stay', async () => {
    stubApi({ summary: () => json({ ...summary, status: 'Cancelled' }) });
    renderPage();
    await settle();

    expect(screen.getByTestId('deposit-error')).toHaveTextContent(/not active/i);
    expect(screen.queryByTestId('deposit-pay')).not.toBeInTheDocument();
  });

  it('refuses a link with no token and calls nothing', async () => {
    stubApi();
    renderPage('/booking/42/deposit');
    await settle();

    expect(screen.getByTestId('deposit-error')).toHaveTextContent(/invalid deposit link/i);
    expect(calls).toHaveLength(0);
  });

  it('shows a clear message for a link whose token the API rejects (404)', async () => {
    stubApi({ summary: () => new Response('', { status: 404 }) });
    renderPage();
    await settle();

    expect(screen.getByTestId('deposit-error')).toHaveTextContent(/couldn't find this booking/i);
    expect(screen.queryByTestId('deposit-pay')).not.toBeInTheDocument();
  });
});
