import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { isValidGstin, normalizeGstin, validateCompanyGstInput } from '@/utils/gstin';
import { CompanyGstFields } from '@/components/checkout/CompanyGstFields';
import { BookingGstDetailsCard } from '@/components/booking/BookingGstDetailsCard';

describe('GUEST-084: GSTIN validation & UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes and validates Indian 15-char GSTINs', () => {
    expect(normalizeGstin(' 29abcde1234f1z5 ')).toBe('29ABCDE1234F1Z5');
    expect(isValidGstin('29ABCDE1234F1Z5')).toBe(true);
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
    expect(isValidGstin('99ABCDE1234F1Z5')).toBe(true);
    expect(isValidGstin('00ABCDE1234F1Z5')).toBe(false); // invalid state code 00
    expect(isValidGstin('29ABCDE1234F1A5')).toBe(false); // 14th char must be Z
    expect(isValidGstin('SHORT')).toBe(false);
  });

  it('returns field errors when company name or GSTIN is invalid', () => {
    const errs = validateCompanyGstInput({ companyName: '', guestGstin: 'INVALID' });
    expect(errs.companyNameError).toBeTruthy();
    expect(errs.gstinError).toBeTruthy();

    const ok = validateCompanyGstInput({ companyName: 'Acme Pvt Ltd', guestGstin: '29ABCDE1234F1Z5' });
    expect(ok.companyNameError).toBeUndefined();
    expect(ok.gstinError).toBeUndefined();
  });

  it('toggles checkout GST fields and uppercases GSTIN input', () => {
    const onToggle = vi.fn();
    const onGstin = vi.fn();
    const { rerender } = render(
      <CompanyGstFields
        enabled={false}
        onToggle={onToggle}
        companyName=""
        onCompanyNameChange={vi.fn()}
        guestGstin=""
        onGuestGstinChange={onGstin}
      />,
    );

    expect(screen.queryByTestId('checkout-gst-fields')).toBeNull();
    fireEvent.click(screen.getByTestId('checkout-gst-toggle'));
    expect(onToggle).toHaveBeenCalledWith(true);

    rerender(
      <CompanyGstFields
        enabled={true}
        onToggle={onToggle}
        companyName="Acme"
        onCompanyNameChange={vi.fn()}
        guestGstin=""
        onGuestGstinChange={onGstin}
      />,
    );

    fireEvent.change(screen.getByTestId('checkout-gstin-input'), { target: { value: '29abcde1234f1z5' } });
    expect(onGstin).toHaveBeenCalledWith('29ABCDE1234F1Z5');
  });

  it('submits PATCH /api/public/bookings/:id/gst-details from BookingGstDetailsCard', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    const onUpdated = vi.fn();
    render(<BookingGstDetailsCard bookingId={42} token="tok123" onUpdated={onUpdated} />);

    fireEvent.change(screen.getByTestId('booking-company-name-input'), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByTestId('booking-gstin-input'), { target: { value: '29abcde1234f1z5' } });
    fireEvent.click(screen.getByTestId('booking-gst-save-btn'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/public/bookings/42/gst-details?t=tok123');
    expect(onUpdated).toHaveBeenCalledWith({ companyName: 'Acme Corp', guestGstin: '29ABCDE1234F1Z5' });
    expect(screen.getByTestId('booking-gst-saved-msg')).toBeTruthy();
    expect(screen.getByTestId('booking-gst-download-pdf')).toBeTruthy();
  });
});
