import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { settle } from '@/test/settle';
import { SelfCheckoutCard, isDepartureDayIst } from '@/components/booking/SelfCheckoutCard';

describe('GUEST-087: SelfCheckoutCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects IST departure day accurately', () => {
    // 2026-11-27 04:00 UTC == 2026-11-27 09:30 IST
    const now = new Date('2026-11-27T04:00:00Z');
    expect(isDepartureDayIst('2026-11-27', now)).toBe(true);
    expect(isDepartureDayIst('2026-11-28', now)).toBe(false);
  });

  it('hides card when not departure day and not already checked out', () => {
    const now = new Date('2026-11-26T04:00:00Z');
    render(
      <SelfCheckoutCard
        bookingId={55}
        token="tok55"
        status="Confirmed"
        checkoutDateIso="2026-11-27"
        now={now}
      />,
    );
    expect(screen.queryByTestId('self-checkout-card')).toBeNull();
  });

  it('submits self-checkout with checklist, rating, and note on departure day', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ guestReportedCheckoutAtUtc: '2026-11-27T05:00:00Z' }),
    } as Response);

    const now = new Date('2026-11-27T04:00:00Z');
    render(
      <SelfCheckoutCard
        bookingId={55}
        token="tok55"
        status="CheckedIn"
        checkoutDateIso="2026-11-27"
        guidebookCheckoutChecklistText={'- Leave key in lockbox\n- Switch off geyser'}
        now={now}
      />,
    );

    fireEvent.click(screen.getByTestId('self-checkout-item-0'));
    fireEvent.click(screen.getByTestId('self-checkout-star-5'));
    fireEvent.change(screen.getByTestId('self-checkout-note'), { target: { value: 'Great stay!' } });
    fireEvent.click(screen.getByTestId('self-checkout-confirm-btn'));

    await settle();
    expect(screen.getByTestId('self-checkout-confirmed')).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/public/bookings/55/guest-checkout?t=tok55');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({
      checkedItems: ['Leave key in lockbox'],
      rating: 5,
      note: 'Great stay!',
    });
  });
});
