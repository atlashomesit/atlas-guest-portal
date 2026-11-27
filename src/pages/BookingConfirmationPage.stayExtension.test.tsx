import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import BookingConfirmationPage from './BookingConfirmationPage';
import { settle } from '../test/settle';

vi.mock('../lib/events', () => ({ track: vi.fn() }));
vi.mock('../components/SEO', () => ({ default: () => null }));
vi.mock('../components/WeatherWidget', () => ({ default: () => null }));
vi.mock('../config/contact', () => ({ getContactEmail: () => '', getContactPhone: () => '', hasHostContact: () => false }));

const baseSummary = {
  bookingId: 9101,
  listingId: 9100,
  guestId: 9102,
  guestName: 'Aarav Rao',
  guestPhone: '9876543210',
  propertyName: 'Hillview Villa',
  listingName: 'Garden Suite',
  checkinDate: 'Mon, 28 Sep 2026',
  checkoutDate: 'Wed, 30 Sep 2026',
  checkinDateIso: '2026-09-28',
  checkoutDateIso: '2026-09-30',
  nights: 2,
  status: 'Confirmed',
  propertyAddress: '',
  propertyPhone: '',
  checkinInstructions: '',
  currency: 'INR',
  totalAmount: 7000,
  wifiVisible: true,
  bookingSource: 'Direct',
  onlinePaymentEnabled: true,
};

async function renderBooking(
  overrides: Record<string, unknown> = {},
  extraFetch?: (url: string, init?: RequestInit) => Response | null
) {
  window.sessionStorage.setItem('booking_9101_payment_status', 'success');
  vi.mocked(global.fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (extraFetch) {
      const custom = extraFetch(url, init);
      if (custom) return custom;
    }
    const body = url.includes('/summary')
      ? { ...baseSummary, ...overrides }
      : url.includes('/messages')
        ? { messages: [] }
        : [];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  render(
    <MemoryRouter initialEntries={['/booking/9101?t=ext-token']}>
      <Routes>
        <Route path="/booking/:bookingId" element={<BookingConfirmationPage />} />
      </Routes>
    </MemoryRouter>
  );
  await settle();
  screen.getByTestId('booking-confirmation-page');
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('GUEST-089 self-service stay extension', () => {
  test('shows Extend your stay for direct Confirmed booking, quotes price difference, and triggers UPI payment', async () => {
    await renderBooking({}, (url) => {
      if (url.includes('/extend-quote')) {
        return new Response(
          JSON.stringify({ available: true, extraNights: 2, extraTotalAmount: 4200, currency: 'INR' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('/extend-order')) {
        return new Response(
          JSON.stringify({ upiDeeplink: 'upi://pay?pa=host@upi&am=4200' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return null;
    });

    fireEvent.click(screen.getByTestId('extend-stay-trigger'));
    const input = screen.getByTestId('extend-stay-date-input');
    fireEvent.change(input, { target: { value: '2026-10-02' } });
    await settle();

    expect(screen.getByTestId('extend-stay-price-diff')).toHaveTextContent('4,200');
    const payBtn = screen.getByTestId('extend-stay-pay-btn');
    expect(payBtn).toHaveTextContent('Pay');
    expect(payBtn).toHaveTextContent('to extend');

    fireEvent.click(payBtn);
    await settle();

    const upiLink = screen.getByTestId('extend-stay-upi-link');
    expect(upiLink).toHaveAttribute('href', 'upi://pay?pa=host@upi&am=4200');
  });

  test('shows plain-English unavailable message on 409 conflict', async () => {
    await renderBooking({}, (url) => {
      if (url.includes('/extend-quote')) {
        return new Response(
          JSON.stringify({ available: false, unavailableReason: 'Oct 1 is already booked on this suite.' }),
          { status: 409, headers: { 'content-type': 'application/json' } }
        );
      }
      return null;
    });

    fireEvent.click(screen.getByTestId('extend-stay-trigger'));
    fireEvent.change(screen.getByTestId('extend-stay-date-input'), { target: { value: '2026-10-02' } });
    await settle();

    expect(screen.getByTestId('extend-stay-unavailable')).toHaveTextContent('Oct 1 is already booked on this suite.');
    expect(screen.queryByTestId('extend-stay-pay-btn')).not.toBeInTheDocument();
  });

  test('hides self-service extension for OTA bookings (keeps host-request path)', async () => {
    await renderBooking({ bookingSource: 'Airbnb', isOtaBooking: true });
    expect(screen.queryByTestId('extend-stay-trigger')).not.toBeInTheDocument();
    expect(screen.getByTestId('modify-dates-link')).toBeInTheDocument();
  });
});
