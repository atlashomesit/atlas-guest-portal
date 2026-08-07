/**
 * TASK-7428 (Done-when #4) over TASK-4161: the merchant-of-record footer disclosure on custom
 * domains is two separate claims. "Booking engine by Atlas PMS" is true for every white-label
 * tenant and stays unconditional. "Payments secured by Razorpay" describes how the guest's money
 * moves and must not render on a tenant where no payment is taken on the site at all
 * (tenants 45 `staybycf` / 55 `millionairesmansion`: paymentProvider null, bookingMode WHATSAPP).
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TenantInfo } from '@/tenant/tenantContext';

const tenantCtxMock = vi.hoisted(() => ({ getTenantContext: vi.fn() }));
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: (...args: unknown[]) => tenantCtxMock.getTenantContext(...args),
}));

const customDomainTenant = (over: Partial<TenantInfo>): TenantInfo => ({
  name: 'Sunrise Villas',
  slug: 'sunrise-villas',
  legalContactPack: {
    legalName: 'Sunrise Villas Hospitality Pvt Ltd',
    displayName: 'Sunrise Villas',
    contactEmail: 'grievance@sunrisevillas.com',
    showAtlasFooterCredit: false,
    isCustomDomain: true,
  },
  ...over,
});

const renderFooter = async () => {
  const { default: Footer } = await import('./Footer');
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
};

describe('TASK-7428: MOR footer disclosure is gated by half', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('online tenant: renders BOTH the booking-engine and the Razorpay payment credit', async () => {
    tenantCtxMock.getTenantContext.mockReturnValue(
      customDomainTenant({ paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' }),
    );

    await renderFooter();

    const disclosure = screen.getByTestId('mor-disclosure');
    expect(disclosure.textContent).toContain('Booking engine by');
    expect(disclosure.textContent).toContain('Atlas PMS');
    expect(disclosure.textContent).toContain('Razorpay');
  });

  it('no-provider tenant: keeps the Atlas PMS credit, drops the Razorpay payment credit', async () => {
    tenantCtxMock.getTenantContext.mockReturnValue(
      customDomainTenant({ paymentProvider: undefined, bookingMode: 'WHATSAPP' }),
    );

    await renderFooter();

    const disclosure = screen.getByTestId('mor-disclosure');
    // TASK-4161 compliance copy survives — this half is not payment-rail dependent.
    expect(disclosure.textContent).toContain('Booking engine by');
    expect(disclosure.textContent).toContain('Atlas PMS');
    expect(disclosure.textContent).toContain('Sunrise Villas Hospitality Pvt Ltd');
    // The payment-rail half must be gone.
    expect(disclosure.textContent).not.toContain('Razorpay');
    expect(disclosure.textContent).not.toContain('Payments secured by');
  });

  it('no-provider tenant: no Razorpay copy anywhere in the footer', async () => {
    tenantCtxMock.getTenantContext.mockReturnValue(
      customDomainTenant({ paymentProvider: undefined, bookingMode: 'WHATSAPP' }),
    );

    const { container } = await renderFooter();

    expect(container.textContent).not.toMatch(/razorpay/i);
  });
});
