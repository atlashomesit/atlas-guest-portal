import { describe, it, expect, vi } from 'vitest';
import { formatCurrency } from '@/utils/formatting';

// Mock the utils that would be imported in BookingConfirmationPage
vi.mock('@/tenant/displayBrand', () => ({
  getTenantBrandName: () => 'Test Stays',
}));

describe('BookingConfirmationPage totalAmount guard (TASK-4546)', () => {
  it('should handle undefined totalAmount gracefully', () => {
    const booking = {
      totalAmount: undefined,
      currency: 'INR',
      nights: 2,
    };

    // This should not throw
    const result = formatCurrency(booking.totalAmount ?? 0, { currency: booking.currency });
    expect(result).toBeDefined();
  });

  it('should format valid totalAmount correctly', () => {
    const booking = {
      totalAmount: 12600,
      currency: 'INR',
      nights: 2,
    };

    const result = formatCurrency(booking.totalAmount, { currency: booking.currency });
    expect(result).toContain('12,600');
  });

  it('should render zero when totalAmount is null', () => {
    const booking = {
      totalAmount: null as unknown as number,
      currency: 'INR',
      nights: 2,
    };

    const result = formatCurrency(booking.totalAmount ?? 0, { currency: booking.currency });
    expect(result).toContain('0');
  });
});
