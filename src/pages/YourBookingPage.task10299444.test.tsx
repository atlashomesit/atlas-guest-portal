import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import YourBookingPage from './YourBookingPage';
import { _resetTenantResolutionForTests, setMarketplaceMode } from '@/tenant/tenantResolver';

// TASK-10299444 / TASK-10299437 / TASK-10299422: the guest's one "Your booking" page. Sample data only.

const base = {
  guestFirstName: 'Aarav', homeName: 'Home 302', brand: 'Atlas Homes',
  checkInDate: '2026-12-08', checkInTime: '13:00', checkOutDate: '2026-12-09', checkOutTime: '11:00', nights: 1, reference: 'ATL-000001',
  status: 'confirmed', isCancelled: false, statusMessage: null, directionsUrl: 'https://www.google.com/maps/search/?api=1&query=17.385,78.4867',
  receipt: {
    title: 'Payment receipt', note: 'This is a receipt, not a tax invoice.', currency: 'INR', total: 2000, amountReceived: 2000, balance: 0, paidThroughBookingSite: false,
    rows: [{ label: 'Total', value: '₹2,000' }, { label: 'Amount received', value: '₹2,000' }, { label: 'Balance', value: '₹0' }], pdfPath: 'receipt.pdf',
  },
  houseRules: { text: 'No parties. Quiet after 10 pm.', pdfUrl: 'https://cdn.example.test/rules.pdf' },
  otherRules: { json: '{"smoking":false,"pets":true,"quietHoursStart":"22:00","quietHoursEnd":"08:00"}' },
  cancellationPolicy: { policyName: 'Moderate', headline: 'Free cancellation until 12:00 AM, 3 Dec', detail: 'After that, a late-cancellation fee may apply.', refundFreeUntilUtc: '2026-12-02T18:30:00Z', timezoneId: 'Asia/Kolkata' },
  agreementLine: 'You have agreed to these.', supportPhone: '+91 70324 93290',
};

function mockFetch(status: number, body?: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderPage(token = 'tok-123') {
  return render(
    <MemoryRouter initialEntries={[`/your-booking/${token}`]}>
      <Routes>
        <Route path="/your-booking/:token" element={<YourBookingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('YourBookingPage', () => {
  beforeEach(() => {
    _resetTenantResolutionForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the stay, the receipt, the house rules, other rules and the cancellation policy, in that order', async () => {
    mockFetch(200, base);
    renderPage();
    await screen.findByTestId('your-booking-stay');
    const ids = ['your-booking-stay', 'your-booking-receipt', 'your-booking-house-rules', 'your-booking-other-rules', 'your-booking-cancellation'];
    const nodes = ids.map((id) => screen.getByTestId(id));
    nodes.slice(1).forEach((n, i) => expect(nodes[i].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
    expect(screen.getByText('Payment receipt')).toBeTruthy();
    expect(screen.getByText('This is a receipt, not a tax invoice.')).toBeTruthy();
    expect(screen.getByText('Free cancellation until 12:00 AM, 3 Dec')).toBeTruthy();
    expect(screen.getByText('No smoking')).toBeTruthy();
    expect(screen.getByTestId('your-booking-directions').getAttribute('href')).toContain('google.com/maps');
    expect(screen.getByTestId('your-booking-receipt-pdf').getAttribute('href')).toContain('/api/public/your-booking/tok-123/receipt.pdf');
  });

  it('says Total, never Paid, and shows no GST or tax-invoice fields', async () => {
    mockFetch(200, base);
    renderPage();
    await screen.findByTestId('your-booking-receipt');
    const receipt = screen.getByTestId('your-booking-receipt').textContent ?? '';
    expect(receipt).toContain('Total');
    expect(receipt).not.toMatch(/\bGSTIN?\b/i);
    expect(receipt).not.toMatch(/invoice (no|number)/i);
    expect(receipt).not.toMatch(/\bPaid\b/);
  });

  it('a listing with no saved rules shows no rules section and the page still loads', async () => {
    mockFetch(200, { ...base, houseRules: null, otherRules: null });
    renderPage();
    await screen.findByTestId('your-booking-receipt');
    expect(screen.queryByTestId('your-booking-house-rules')).toBeNull();
    expect(screen.queryByTestId('your-booking-other-rules')).toBeNull();
    expect(screen.getByTestId('your-booking-cancellation')).toBeTruthy();
  });

  it('a cancelled booking says so in plain words and still shows the policy', async () => {
    mockFetch(200, { ...base, status: 'cancelled', isCancelled: true, statusMessage: 'This booking is cancelled.' });
    renderPage();
    expect((await screen.findByTestId('your-booking-cancelled')).textContent).toBe('This booking is cancelled.');
    expect(screen.getByTestId('your-booking-cancellation')).toBeTruthy();
  });

  it('an invalid, expired or tampered link shows one plain message and none of the page', async () => {
    mockFetch(404, { error: 'YOUR_BOOKING_LINK_INVALID' });
    renderPage();
    expect((await screen.findByTestId('your-booking-invalid')).textContent).toContain('This link is not valid any more');
    expect(screen.queryByTestId('your-booking-stay')).toBeNull();
    expect(screen.queryByTestId('your-booking-receipt')).toBeNull();
  });

  it('a server failure shows a plain retry message, never a stack trace', async () => {
    mockFetch(500, {});
    renderPage();
    const el = await screen.findByTestId('your-booking-error');
    expect(el.textContent).not.toMatch(/exception|stack|at \w+\./i);
  });

  it('carries the quiet Powered by Atlas line with the your-booking tag', async () => {
    mockFetch(200, base);
    renderPage();
    const link = await screen.findByTestId('powered-by-atlas');
    expect(link.getAttribute('href')).toContain('utm_source=powered-by');
    expect(link.getAttribute('href')).toContain('utm_medium=your-booking');
  });

  it('sends no tenant header on the marketplace host (the token names the tenant) and the host tenant header on a host site', async () => {
    setMarketplaceMode(true);
    const marketplace = mockFetch(200, base);
    const view = renderPage();
    await waitFor(() => expect(marketplace).toHaveBeenCalled());
    expect((marketplace.mock.calls[0][1] as { headers: Record<string, string> }).headers).toEqual({});
    view.unmount();
    _resetTenantResolutionForTests();
  });
});
