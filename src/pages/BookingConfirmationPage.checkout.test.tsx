import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import BookingConfirmationPage from './BookingConfirmationPage';

vi.mock('../lib/events', () => ({ track: vi.fn() }));
vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../components/WeatherWidget', () => ({ default: () => null }));
vi.mock('../config/contact', () => ({ getContactEmail: () => '', getContactPhone: () => '', hasHostContact: () => false }));

const instructions = 'Leave the keys in the kitchen lockbox.\nClose the balcony door.\nMessage the host once you have left.';
const summary = {
  bookingId: 9001, listingId: 9000, guestId: 9002, guestName: 'Test Guest',
  propertyName: 'Garden Stays', listingName: 'Garden home', checkinDate: 'Mon, 28 Sep 2026',
  checkoutDate: 'Wed, 30 Sep 2026', nights: 2, status: 'CheckedIn',
  propertyAddress: '', propertyPhone: '', currency: 'INR', totalAmount: 7000,
  wifiVisible: true, checkoutBriefingVisible: true, checkOutTime: '11:00',
  guidebookCheckoutChecklistText: instructions,
};

async function renderBooking(overrides: Record<string, unknown> = {}) {
  window.sessionStorage.setItem('booking_9001_payment_status', 'success');
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    const body = url.includes('/summary') ? { ...summary, ...overrides }
      : url.includes('/messages') ? { messages: [] } : [];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  render(<MemoryRouter initialEntries={['/booking/9001?t=synthetic-token']}>
    <Routes><Route path="/booking/:bookingId" element={<BookingConfirmationPage />} /></Routes>
  </MemoryRouter>);
  await screen.findByTestId('booking-confirmation-page');
}

afterEach(() => { vi.restoreAllMocks(); window.sessionStorage.clear(); });

describe('GUEST-005 checkout briefing', () => {
  test.each(['Confirmed', 'CheckedIn'])('shows host instructions immediately for server-approved %s stay', async (status) => {
    await renderBooking({ status });
    const card = screen.getByRole('region', { name: 'Before you check out' });
    expect(within(card).getByText('From your host')).toBeVisible();
    expect(within(card).getByTestId('checkout-briefing-instructions').textContent).toBe(instructions);
    expect(within(card).getByText('Wed, 30 Sep 2026')).toBeVisible();
    expect(within(card).getByText('Check-out by 11:00')).toBeVisible();
    expect(within(card).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(card.compareDocumentPosition(screen.getByTestId('confirmation-qr-section')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test.each([false, undefined, null, 'true'])('requires the strict server flag: %s', async (flag) => {
    await renderBooking({ checkoutBriefingVisible: flag });
    expect(screen.queryByTestId('checkout-briefing')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('guidebook-section-checkout'));
    expect(screen.getByTestId('guest-guidebook')).toHaveTextContent('Leave the keys in the kitchen lockbox.');
  });

  test.each(['Cancelled', 'CheckedOut', 'Pending'])('does not show a stale true flag for %s status', async (status) => {
    await renderBooking({ status });
    expect(screen.queryByTestId('checkout-briefing')).not.toBeInTheDocument();
  });

  test.each([null, '', '  \n  '])('does not invent missing host instructions: %s', async (content) => {
    await renderBooking({ guidebookCheckoutChecklistText: content });
    expect(screen.queryByTestId('checkout-briefing')).not.toBeInTheDocument();
  });

  test('uses no invented checkout hour and displays host text as text', async () => {
    await renderBooking({ checkOutTime: undefined, guidebookCheckoutChecklistText: 'Return keys.\n<script>alert("host")</script>' });
    const card = screen.getByRole('region', { name: 'Before you check out' });
    expect(within(card).queryByText(/Check-out by/)).not.toBeInTheDocument();
    expect(card).toHaveTextContent('<script>alert("host")</script>');
    expect(card.querySelector('script')).toBeNull();
  });
});
