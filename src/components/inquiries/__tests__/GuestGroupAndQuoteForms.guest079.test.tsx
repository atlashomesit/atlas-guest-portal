import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GuestGroupAndQuoteForms from '../GuestGroupAndQuoteForms';

describe('GuestGroupAndQuoteForms (GUEST-079)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('validates and submits "Booking for a group?" form to POST /api/group-inquiries with truthful success copy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 42 }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <GuestGroupAndQuoteForms
        listingId={101}
        listingName="Atlas Penthouse"
        defaultCity="Hyderabad"
        tenantSlug="atlas"
      />,
    );

    fireEvent.click(screen.getByTestId('booking-for-group-trigger'));
    expect(screen.getByTestId('group-inquiry-modal')).toBeInTheDocument();

    // Submit empty to trigger client validation
    fireEvent.click(screen.getByTestId('group-inquiry-submit'));
    expect(await screen.findByTestId('guest-inquiry-error')).toHaveTextContent(
      'Please select a check-in date.',
    );
    expect(fetchMock).not.toHaveBeenCalled();

    // Fill valid fields
    fireEvent.change(screen.getByTestId('group-inquiry-checkin'), {
      target: { value: '2026-12-10' },
    });
    fireEvent.change(screen.getByTestId('group-inquiry-checkout'), {
      target: { value: '2026-12-12' },
    });
    fireEvent.change(screen.getByTestId('group-inquiry-size'), {
      target: { value: '8' },
    });
    fireEvent.change(screen.getByTestId('group-inquiry-name'), {
      target: { value: 'Aarav Sharma' },
    });
    fireEvent.change(screen.getByTestId('group-inquiry-phone'), {
      target: { value: '9876543210' },
    });
    fireEvent.change(screen.getByTestId('group-inquiry-requirements'), {
      target: { value: 'Need 4 double rooms' },
    });

    fireEvent.click(screen.getByTestId('group-inquiry-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('guest-inquiry-success')).toHaveTextContent(
        'Your enquiry has been sent to the host.',
      );
    });
    expect(screen.getByTestId('guest-inquiry-success').textContent).not.toContain('within 2 hours');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain('/api/group-inquiries');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers['X-Tenant-Slug']).toBe('atlas');
    expect(JSON.parse(calledInit.body)).toMatchObject({
      city: 'Hyderabad',
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      groupSize: 8,
      requirements: 'Need 4 double rooms',
      contactName: 'Aarav Sharma',
      contactPhone: '9876543210',
    });
  });

  it('validates and submits "Send me a quote" form to POST /api/leads with source: "quote_form"', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 99, status: 'New' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <GuestGroupAndQuoteForms
        listingId={202}
        listingName="Garden Villa"
        tenantSlug="atlas"
      />,
    );

    fireEvent.click(screen.getByTestId('send-me-quote-trigger'));
    expect(screen.getByTestId('send-quote-modal')).toBeInTheDocument();

    // Missing name validation
    fireEvent.click(screen.getByTestId('quote-lead-submit'));
    expect(await screen.findByTestId('guest-inquiry-error')).toHaveTextContent(
      'Please enter your name.',
    );

    fireEvent.change(screen.getByTestId('quote-lead-name'), {
      target: { value: 'Meera Nair' },
    });
    fireEvent.change(screen.getByTestId('quote-lead-phone'), {
      target: { value: '9123456789' },
    });
    fireEvent.change(screen.getByTestId('quote-lead-message'), {
      target: { value: 'Looking for a weekend quote' },
    });

    fireEvent.click(screen.getByTestId('quote-lead-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('guest-inquiry-success')).toHaveTextContent(
        'Your enquiry has been sent to the host.',
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain('/api/leads');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers['X-Tenant-Slug']).toBe('atlas');
    expect(JSON.parse(calledInit.body)).toMatchObject({
      listingId: 202,
      guestName: 'Meera Nair',
      phone: '9123456789',
      message: 'Looking for a weekend quote',
      source: 'quote_form',
    });
  });

  it('displays plain-sentence error messages on 429 and 4xx responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Listing does not belong to this host.' }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <GuestGroupAndQuoteForms
        listingId={303}
        listingName="Hilltop Cottage"
        tenantSlug="atlas"
      />,
    );

    fireEvent.click(screen.getByTestId('send-me-quote-trigger'));
    fireEvent.change(screen.getByTestId('quote-lead-name'), {
      target: { value: 'Rohan Gupta' },
    });
    fireEvent.change(screen.getByTestId('quote-lead-phone'), {
      target: { value: '9988776655' },
    });

    // 429 response
    fireEvent.click(screen.getByTestId('quote-lead-submit'));
    expect(await screen.findByTestId('guest-inquiry-error')).toHaveTextContent(
      'Too many requests. Please wait a moment and try again.',
    );

    // 400 response
    fireEvent.click(screen.getByTestId('quote-lead-submit'));
    expect(await screen.findByTestId('guest-inquiry-error')).toHaveTextContent(
      'Listing does not belong to this host.',
    );
  });
});
