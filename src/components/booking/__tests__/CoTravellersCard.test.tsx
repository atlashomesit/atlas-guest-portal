import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { settle } from '@/test/settle';
import { CoTravellersCard } from '@/components/booking/CoTravellersCard';

describe('GUEST-086: CoTravellersCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a co-traveller, renders shareable arrival link, and removes them', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 99,
          name: 'Rohan Mehta',
          phone: '+919876543210',
          accessToken: 'ct-abc',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

    render(<CoTravellersCard bookingId={77} token="tok77" propertyName="Atlas Villa" maxCoTravellers={3} />);

    fireEvent.change(screen.getByTestId('co-traveller-name-input'), { target: { value: 'Rohan Mehta' } });
    fireEvent.change(screen.getByTestId('co-traveller-contact-input'), { target: { value: '+919876543210' } });
    fireEvent.click(screen.getByTestId('co-traveller-add-btn'));

    await settle();
    expect(screen.getByTestId('co-traveller-row-99')).toBeTruthy();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/public/bookings/77/co-travellers?t=tok77');
    expect(screen.getByTestId('co-traveller-wa-99').getAttribute('href')).toContain('ct-abc');

    fireEvent.click(screen.getByTestId('co-traveller-remove-99'));
    await settle();
    expect(screen.queryByTestId('co-traveller-row-99')).toBeNull();
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/public/bookings/77/co-travellers/99?t=tok77');
  });
});
