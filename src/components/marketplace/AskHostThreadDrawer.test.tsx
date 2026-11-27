import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AskHostThreadDrawer } from './AskHostThreadDrawer';

describe('AskHostThreadDrawer (MKT-068)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts a pre-booking Q&A thread and allows follow-up replies without leaving the page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          threadToken: 'tok-abc-123',
          messages: [
            { id: '1', sender: 'guest', body: 'Is inverter backup available?', createdAt: '2026-11-27T00:00:00Z' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const onClose = vi.fn();
    render(
      <AskHostThreadDrawer
        open={true}
        onClose={onClose}
        listingId={42}
        listingTitle="Sunset Villa Goa"
        hostName="Ravi"
        tenantSlug="goastays"
        checkIn="2026-12-12"
        checkOut="2026-12-14"
        guests={2}
      />,
    );

    expect(screen.getByText('Ask Ravi')).toBeTruthy();
    fireEvent.change(screen.getByTestId('ask-host-name'), { target: { value: 'Ananya' } });
    fireEvent.change(screen.getByTestId('ask-host-contact'), { target: { value: 'ananya@example.com' } });
    fireEvent.change(screen.getByTestId('ask-host-question'), { target: { value: 'Is inverter backup available?' } });
    fireEvent.click(screen.getByTestId('ask-host-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('ask-host-thread-messages')).toBeTruthy();
      expect(screen.getByText('Is inverter backup available?')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('ask-host-reply-input'), { target: { value: 'Also is parking covered?' } });
    fireEvent.click(screen.getByTestId('ask-host-reply-submit'));

    await waitFor(() => {
      expect(screen.getByText('Also is parking covered?')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('ask-host-drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
