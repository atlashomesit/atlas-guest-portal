/**
 * TASK-7428 (founder-ruled 2026-08-05): "no processor, no fee".
 *
 * `hasOnlinePaymentRail` is the single gate behind the payment-processing fee row, the Razorpay
 * pay rail, the property-details "You pay the host directly via Razorpay" claim, and the
 * payment-processor half of the TASK-4161 MOR footer disclosure. Its false branch is a money
 * assertion — it decides whether the total a guest is shown equals what the host will ask for.
 */

import { describe, it, expect } from 'vitest';
import { hasOnlinePaymentRail } from './paymentRail';
import type { TenantInfo } from './tenantContext';

const tenant = (over: Partial<TenantInfo>): TenantInfo => ({
  name: 'Test Tenant',
  slug: 'test-tenant',
  ...over,
});

describe('TASK-7428: hasOnlinePaymentRail', () => {
  it('is false for the live staybycf shape (paymentProvider null, bookingMode WHATSAPP)', () => {
    // Verbatim from GET /tenants/from-domain?domain=staybycf.atlastays.com (tenant 45).
    expect(
      hasOnlinePaymentRail(tenant({ paymentProvider: undefined, bookingMode: 'WHATSAPP' })),
    ).toBe(false);
  });

  it('is true for a Razorpay tenant in ONLINE booking mode', () => {
    expect(
      hasOnlinePaymentRail(tenant({ paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' })),
    ).toBe(true);
  });

  it('is true for a non-Razorpay online gateway (UPI_QR) — the rail exists, fee is honest', () => {
    expect(
      hasOnlinePaymentRail(tenant({ paymentProvider: 'UPI_QR', bookingMode: 'ONLINE' })),
    ).toBe(true);
  });

  it('is false for MANUAL / pay-on-arrival — booking captured, no gateway, so no gateway fee', () => {
    expect(
      hasOnlinePaymentRail(tenant({ paymentProvider: 'MANUAL', bookingMode: 'MANUAL' })),
    ).toBe(false);
  });

  it('is false when the tenant has neither a provider nor a phone ("Bookings opening soon")', () => {
    expect(hasOnlinePaymentRail(tenant({}))).toBe(false);
  });

  it('is false when no tenant context has resolved at all', () => {
    expect(hasOnlinePaymentRail(null)).toBe(false);
  });

  it('bookingMode wins over a stale provider string — WHATSAPP means routing is Blocked', () => {
    // An ACTIVE-but-uncredentialed Razorpay row resolves to Blocked server-side and would 422 at
    // checkout; the server reports WHATSAPP. Never quote a fee that checkout cannot even reach.
    expect(
      hasOnlinePaymentRail(tenant({ paymentProvider: 'RAZORPAY', bookingMode: 'WHATSAPP' })),
    ).toBe(false);
  });

  it('falls back to the provider string when bookingMode is absent (legacy validateTenant shape)', () => {
    expect(hasOnlinePaymentRail(tenant({ paymentProvider: 'RAZORPAY' }))).toBe(true);
    expect(hasOnlinePaymentRail(tenant({ paymentProvider: 'manual' }))).toBe(false);
    expect(hasOnlinePaymentRail(tenant({ paymentProvider: '   ' }))).toBe(false);
  });
});
