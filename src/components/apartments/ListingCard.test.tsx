/**
 * TASK-101158: "Secure Razorpay payments" chip must gate on hasOnlinePaymentRail — a tenant
 * whose routing resolves to WHATSAPP/MANUAL (paymentProvider null) never takes an online
 * payment on this site, so the chip must be omitted (not reworded) rather than shown
 * unconditionally.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TenantInfo } from '@/tenant/tenantContext';
import { CurrencyProvider } from '../../contexts/CurrencyContext';
import { BookingProvider } from '../../contexts/BookingContext';
import ListingCard from './ListingCard';

const tenantCtxMock = vi.hoisted(() => ({ getTenantContext: vi.fn() }));
vi.mock('@/tenant/tenantContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tenant/tenantContext')>();
  return {
    ...actual,
    getTenantContext: (...args: unknown[]) => tenantCtxMock.getTenantContext(...args),
  };
});

const baseTenant = (over: Partial<TenantInfo>): TenantInfo => ({
  name: 'Atlas Homestays',
  slug: 'atlas',
  isMarketplaceRoot: true,
  ...over,
});

const renderCard = () =>
  render(
    <CurrencyProvider>
      <BookingProvider>
        <ListingCard
          id="1"
          name="Sunrise Villa"
          location="Hyderabad"
          image=""
          price={4000}
          rating={4.5}
          reviews={10}
          propertyType="Villa"
          guests={4}
          petFriendly={false}
        />
      </BookingProvider>
    </CurrencyProvider>,
  );

describe('TASK-101158: ListingCard Razorpay chip is gated by hasOnlinePaymentRail', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('WHATSAPP/no-provider tenant: no Razorpay or UPI claim anywhere on the card', () => {
    tenantCtxMock.getTenantContext.mockReturnValue(
      baseTenant({ paymentProvider: undefined, bookingMode: 'WHATSAPP' }),
    );

    const { container } = renderCard();

    expect(container.textContent).not.toMatch(/razorpay/i);
    expect(container.textContent).not.toMatch(/\bUPI\b/i);
  });

  it('ONLINE tenant: card still shows the Razorpay payments chip', () => {
    tenantCtxMock.getTenantContext.mockReturnValue(
      baseTenant({ paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' }),
    );

    renderCard();

    expect(screen.getByText(/secure razorpay payments/i)).toBeInTheDocument();
  });
});
