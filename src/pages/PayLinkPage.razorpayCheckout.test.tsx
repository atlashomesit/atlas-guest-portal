/**
 * @vitest-environment jsdom
 * PAY-016 done-whens 3 and 4: for a Razorpay host the first-party pay page opens Razorpay Checkout IN the page for the order the API created, hands what Checkout
 * returned to the API (which verifies it server-side), and only then lands on the booking confirmation. Every refusal leaves the booking unpaid with a plain
 * sentence, an OTA-prepaid booking owes nothing, and Razorpay's own hosted link is only the fallback when the checkout window cannot open.
 */
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PayLinkPage from './PayLinkPage';
import { verifyPayLinkPayment } from '../api/payLink';
import { settle } from '../test/settle';

vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('qrcode.react', () => ({ QRCodeSVG: () => <svg data-testid="qr-svg" /> }));
const loadCheckout = vi.hoisted(() => vi.fn());
vi.mock('../components/qrmenu/payNow', () => ({ loadRazorpayCheckout: loadCheckout }));

const SUMMARY = {
  bookingId: 77, propertyName: 'Lake View Villa', listingName: 'Lake Room', checkIn: '2026-11-10', checkOut: '2026-11-12', nights: 2,
  guestFirstName: 'Meera', hostName: 'Lake View', amountDueInr: 5000, currency: 'INR', mode: 'RAZORPAY', alreadyPaid: false,
};
const RZP_ORDER = {
  mode: 'RAZORPAY', bookingId: 77, amountInr: 5000, paymentUrl: 'https://rzp.io/i/backup',
  razorpayKeyId: 'rzp_test_KEY', razorpayOrderId: 'order_123', amountPaise: 500000,
};
const CHECKOUT_RESULT = { razorpay_order_id: 'order_123', razorpay_payment_id: 'pay_456', razorpay_signature: 'sig_789' };

const json = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/pay/the-token']}>
      <Routes>
        <Route path="/pay/:token" element={<PayLinkPage />} />
        <Route path="/booking/:bookingId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

type CheckoutOptions = {
  key: string; order_id: string; amount: number; currency: string; name: string;
  handler: (r: typeof CHECKOUT_RESULT) => void; modal: { ondismiss: () => void };
};
let opened: CheckoutOptions | null;
let failedHandler: (() => void) | null;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  opened = null;
  failedHandler = null;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  loadCheckout.mockReset();
  loadCheckout.mockImplementation(async () => {
    (window as unknown as { Razorpay: unknown }).Razorpay = class {
      constructor(options: CheckoutOptions) { opened = options; }
      on(event: string, handler: () => void) { if (event === 'payment.failed') failedHandler = handler; }
      open() { /* the test drives the handler */ }
    };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as unknown as { Razorpay?: unknown }).Razorpay;
});

/** Lets the mocked fetch chain finish (by order, not by wall clock), then reads the element. */
const find = async (id: string) => {
  await settle();
  return screen.getByTestId(id);
};

const verifyCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/verify'));

function serve(verify: () => Promise<Response>, order: unknown = RZP_ORDER, summary: unknown = SUMMARY) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).endsWith('/verify')) return verify();
    return init?.method === 'POST' ? json(200, order) : json(200, summary);
  });
}

describe('PayLinkPage Razorpay in-page checkout (PAY-016)', () => {
  it('opens Razorpay Checkout in the page for the API order, verifies on the server, then lands on the confirmation with the booking token', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    serve(() => json(200, { success: true, bookingId: 77, bookingToken: 'BT-1' }));
    renderPage();

    fireEvent.click(await find('pay-link-razorpay-pay'));

    await settle();
    expect(opened).not.toBeNull();
    expect(opened).toMatchObject({ key: 'rzp_test_KEY', order_id: 'order_123', amount: 500000, currency: 'INR', name: 'Lake View' });
    expect(verifyCalls()).toHaveLength(0);   // nothing is confirmed before Checkout returns

    opened!.handler(CHECKOUT_RESULT);

    await settle();
    expect(screen.getByTestId('location')).toHaveTextContent('/booking/77?t=BT-1');
    const [, init] = verifyCalls()[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      razorpayOrderId: 'order_123', razorpayPaymentId: 'pay_456', razorpaySignature: 'sig_789',
    });
    expect(assign).not.toHaveBeenCalled();   // Razorpay's hosted link was not used
  });

  it('a server refusal leaves the booking unpaid: plain sentence, no confirmation page, and "check again" does not reopen Checkout', async () => {
    let answer = 0;
    serve(() => (answer++ === 0
      ? json(400, { error: 'PAYMENT_NOT_VERIFIED', message: 'We could not verify this payment, so nothing was marked paid. If money was taken, do not pay again - contact your host.' })
      : json(200, { success: true, bookingId: 77, bookingToken: 'BT-2' })));
    renderPage();

    fireEvent.click(await find('pay-link-razorpay-pay'));
    await settle();
    expect(opened).not.toBeNull();
    opened!.handler(CHECKOUT_RESULT);

    expect(await find('pay-link-action-error')).toHaveTextContent('nothing was marked paid');
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pay-link-razorpay-pay')).not.toBeInTheDocument();   // no second Pay button while a payment is unconfirmed

    fireEvent.click(screen.getByTestId('pay-link-check-again'));
    await settle();
    expect(screen.getByTestId('location')).toHaveTextContent('/booking/77?t=BT-2');
    expect(verifyCalls()).toHaveLength(2);
    expect(JSON.parse((verifyCalls()[1][1] as RequestInit).body as string).razorpayPaymentId).toBe('pay_456');   // the same payment, re-checked
  });

  it('closing the checkout window says the guest was not charged and confirms nothing', async () => {
    serve(() => json(200, { success: true, bookingId: 77 }));
    renderPage();

    fireEvent.click(await find('pay-link-razorpay-pay'));
    await settle();
    expect(opened).not.toBeNull();
    opened!.modal.ondismiss();

    expect(await find('pay-link-action-error')).toHaveTextContent('You have not been charged');
    expect(verifyCalls()).toHaveLength(0);
    expect(screen.getByTestId('pay-link-razorpay-pay')).toBeInTheDocument();   // free to try again
  });

  it('a failed payment says the guest was not charged and confirms nothing', async () => {
    serve(() => json(200, { success: true, bookingId: 77 }));
    renderPage();

    fireEvent.click(await find('pay-link-razorpay-pay'));
    await settle();
    expect(failedHandler).not.toBeNull();
    failedHandler!();

    expect(await find('pay-link-action-error')).toHaveTextContent('did not go through');
    expect(verifyCalls()).toHaveLength(0);
  });

  it('a lost connection while confirming says it is not marked paid and not to pay again', async () => {
    serve(() => Promise.reject(new TypeError('network down')));
    renderPage();

    fireEvent.click(await find('pay-link-razorpay-pay'));
    await settle();
    expect(opened).not.toBeNull();
    opened!.handler(CHECKOUT_RESULT);

    const message = await find('pay-link-action-error');
    expect(message).toHaveTextContent('not marked paid');
    expect(message).toHaveTextContent('do not pay again');
    expect(screen.getByTestId('pay-link-check-again')).toBeInTheDocument();
  });

  it('when the checkout window cannot open, Razorpay\'s hosted link is the fallback', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    loadCheckout.mockRejectedValue(new Error('The secure payment window could not load. Check your connection and try again.'));
    serve(() => json(200, { success: true, bookingId: 77 }));
    renderPage();

    fireEvent.click(await find('pay-link-razorpay-pay'));

    await settle();
    expect(assign).toHaveBeenCalledWith('https://rzp.io/i/backup');
    expect(verifyCalls()).toHaveLength(0);
  });

  it('an API that only offers the hosted link (no in-page order) still works as before', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    serve(() => json(200, { success: true, bookingId: 77 }), { mode: 'RAZORPAY', bookingId: 77, amountInr: 5000, paymentUrl: 'https://rzp.io/i/only' });
    renderPage();

    fireEvent.click(await find('pay-link-razorpay-pay'));

    await settle();
    expect(assign).toHaveBeenCalledWith('https://rzp.io/i/only');
    expect(loadCheckout).not.toHaveBeenCalled();
  });

  it('an OTA-prepaid booking (nothing owed) shows nothing to pay and never offers checkout', async () => {
    serve(() => json(200, { success: true, bookingId: 77 }), RZP_ORDER, { ...SUMMARY, amountDueInr: 0, alreadyPaid: true, mode: 'NONE' });
    renderPage();

    expect(await find('pay-link-amount')).toHaveTextContent('Nothing left to pay');
    expect(screen.queryByTestId('pay-link-razorpay-pay')).not.toBeInTheDocument();
    expect(loadCheckout).not.toHaveBeenCalled();
  });
});

describe('verifyPayLinkPayment', () => {
  it('maps the checkout fields, and a 404 or a refusal throws a plain PayLinkError', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    f.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
    await expect(verifyPayLinkPayment('tok', CHECKOUT_RESULT)).rejects.toThrow('not valid any more');

    f.mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({ message: 'Please wait a minute and check again.' }) } as Response);
    await expect(verifyPayLinkPayment('tok', CHECKOUT_RESULT)).rejects.toThrow('Please wait a minute');

    f.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ success: false, bookingId: 1 }) } as Response);
    await expect(verifyPayLinkPayment('tok', CHECKOUT_RESULT)).rejects.toThrow('not marked paid');
  });
});
