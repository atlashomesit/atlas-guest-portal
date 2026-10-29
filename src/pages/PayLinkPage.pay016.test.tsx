/**
 * @vitest-environment jsdom
 * PAY-016: the first-party pay page `/pay/:token`. A UPI host's guest gets the one-tap UPI intent + QR and "I have paid" (which only tells the host);
 * a Razorpay host's guest is sent to Razorpay checkout for the API's amount; a paid-up, unavailable or invalid link says so in words.
 */
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PayLinkPage from './PayLinkPage';

vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('qrcode.react', () => ({ QRCodeSVG: () => <svg data-testid="qr-svg" /> }));

const SUMMARY = {
  bookingId: 77, propertyName: 'Hill Stay Villa', listingName: 'Garden Room', checkIn: '2026-11-10', checkOut: '2026-11-12', nights: 2,
  guestFirstName: 'Asha', hostName: 'Hill Stay', amountDueInr: 5000, currency: 'INR', mode: 'UPI_DEEPLINK', alreadyPaid: false,
  upiVpa: 'host@upi', payeeName: 'Hill Stay Homestay',
};
const UPI_ORDER = {
  mode: 'UPI_DEEPLINK', bookingId: 77, amountInr: 5000, paymentUrl: null,
  upiUri: 'upi://pay?pa=host%40upi&pn=Hill%20Stay&am=5000.00&cu=INR', upiVpa: 'host@upi', payeeName: 'Hill Stay Homestay',
  qrCodeUrl: 'data:image/svg+xml;base64,AAAA', txnRef: 'ATL-77-12345', bookingToken: 'tok123',
};

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

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const calls = () => fetchMock.mock.calls.map((c) => [String(c[0]), (c[1] as RequestInit | undefined)?.method ?? 'GET'] as const);

describe('PayLinkPage (PAY-016)', () => {
  it('UPI host: shows the stay and the amount, then the UPI panel with the intent link and QR, with no checkout countdown', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(200, UPI_ORDER) : json(200, SUMMARY));
    renderPage();

    expect(await screen.findByTestId('pay-link-title')).toHaveTextContent('Hi Asha, pay for your stay at Hill Stay');
    expect(screen.getByTestId('pay-link-summary')).toHaveTextContent('Hill Stay Villa - Garden Room');
    expect(screen.getByTestId('pay-link-amount')).toHaveTextContent('5,000');

    fireEvent.click(screen.getByTestId('pay-link-upi-start'));
    expect(await screen.findByTestId('upi-pay-panel')).toBeInTheDocument();
    expect(screen.getByTestId('upi-pay-vpa')).toHaveTextContent('host@upi');
    expect(screen.queryByTestId('upi-pay-hold-line')).not.toBeInTheDocument();
    expect(calls()).toEqual([
      [expect.stringContaining('/api/guest/payments/link/the-token'), 'GET'],
      [expect.stringContaining('/api/guest/payments/link/the-token/order'), 'POST'],
    ]);
  });

  it('"I have paid" tells the host with the booking token, then lands on the booking page (never marks it paid)', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/upi-deeplink/guest-reported-paid')) return json(200, { status: 'awaiting_host_confirmation' });
      return init?.method === 'POST' ? json(200, UPI_ORDER) : json(200, SUMMARY);
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('pay-link-upi-start'));
    fireEvent.click(await screen.findByTestId('upi-pay-i-have-paid'));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/booking/77?t=tok123'));
    const report = fetchMock.mock.calls.find((c) => String(c[0]).includes('guest-reported-paid'))!;
    expect(JSON.parse((report[1] as RequestInit).body as string)).toEqual({ bookingId: 77, bookingToken: 'tok123' });
  });

  it('Razorpay host: the pay button sends the guest to the API-provided checkout URL', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json(200, { mode: 'RAZORPAY', bookingId: 77, amountInr: 5000, paymentUrl: 'https://rzp.io/i/abc' })
        : json(200, { ...SUMMARY, mode: 'RAZORPAY', upiVpa: null }));
    renderPage();

    fireEvent.click(await screen.findByTestId('pay-link-razorpay-pay'));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://rzp.io/i/abc'));
  });

  it('a paid-up booking says nothing is left to pay and offers no payment', async () => {
    fetchMock.mockImplementation(() => json(200, { ...SUMMARY, amountDueInr: 0, alreadyPaid: true, mode: 'NONE' }));
    renderPage();

    expect(await screen.findByTestId('pay-link-paid')).toBeInTheDocument();
    expect(screen.getByTestId('pay-link-amount')).toHaveTextContent('Nothing left to pay');
    expect(screen.queryByTestId('pay-link-upi-start')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pay-link-razorpay-pay')).not.toBeInTheDocument();
  });

  it('a host with no online rail is told to contact the host', async () => {
    fetchMock.mockImplementation(() => json(200, { ...SUMMARY, mode: 'UNAVAILABLE' }));
    renderPage();
    expect(await screen.findByTestId('pay-link-unavailable')).toHaveTextContent('contact your host');
  });

  it('an invalid or expired link is a plain sentence, not a blank page', async () => {
    fetchMock.mockImplementation(() => json(404, { error: 'PAY_LINK_INVALID' }));
    renderPage();
    expect(await screen.findByTestId('pay-link-error')).toHaveTextContent('not valid any more');
  });

  it('a refused order start shows the API sentence and stays on the page', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(502, { message: 'We could not start the payment. Please try again in a minute.' }) : json(200, SUMMARY));
    renderPage();

    fireEvent.click(await screen.findByTestId('pay-link-upi-start'));

    expect(await screen.findByTestId('pay-link-action-error')).toHaveTextContent('try again in a minute');
  });
});
