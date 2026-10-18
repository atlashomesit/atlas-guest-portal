import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  _resetTenantContextForTests,
  _setTenantContextForTests,
  resolveFromDomain,
  type TenantInfo,
} from '@/tenant/tenantContext';
import {
  hasOnlinePaymentRail,
  isTenantNotTakingBookings,
  isTenantTrialPayAtPropertyOnly,
  NOT_TAKING_BOOKINGS_COPY,
  TRIAL_PAY_AT_PROPERTY_COPY,
} from '@/tenant/paymentRail';

describe('Guest Portal Subscriber Lifecycle (TASK-10298790 & TASK-10298791)', () => {
  beforeEach(() => {
    _resetTenantContextForTests();
    vi.restoreAllMocks();
  });

  it('TASK-10298790: disables online guest payments (pay at property only) when tenant is in Trial', () => {
    const trialTenant: TenantInfo = {
      name: 'Coorg Trial Homestay',
      slug: 'coorg-trial',
      bookingMode: 'ONLINE',
      paymentProvider: 'RAZORPAY',
      lifecycleStage: 'Trial',
      onlinePaymentsEnabled: false,
    };
    _setTenantContextForTests(trialTenant);

    expect(isTenantTrialPayAtPropertyOnly(trialTenant)).toBe(true);
    expect(hasOnlinePaymentRail(trialTenant)).toBe(false);
    expect(TRIAL_PAY_AT_PROPERTY_COPY).toMatch(/Pay at property only/i);
  });

  it('TASK-10298791: marks tenant as not taking bookings and disables online rail when Blocked or websiteStatus=not_taking_bookings', () => {
    const blockedTenant: TenantInfo = {
      name: 'Lapsed Villa',
      slug: 'lapsed-villa',
      bookingMode: 'ONLINE',
      paymentProvider: 'RAZORPAY',
      lifecycleStage: 'Blocked',
      websiteStatus: 'not_taking_bookings',
    };
    _setTenantContextForTests(blockedTenant);

    expect(isTenantNotTakingBookings(blockedTenant)).toBe(true);
    expect(hasOnlinePaymentRail(blockedTenant)).toBe(false);
    expect(NOT_TAKING_BOOKINGS_COPY).toMatch(/not taking bookings right now/i);
  });

  it('parses lifecycleStage, websiteStatus, onlinePaymentsEnabled, and notTakingBookings from /tenants/from-domain', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tenantSlug: 'blocked-host',
          brandName: 'Blocked Host Stay',
          lifecycleStage: 'Blocked',
          websiteStatus: 'not_taking_bookings',
          onlinePaymentsEnabled: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const info = await resolveFromDomain('https://api.atlaspms.in', 'blocked-host.atlastays.com');
    expect(info).not.toBeNull();
    expect(info?.lifecycleStage).toBe('Blocked');
    expect(info?.websiteStatus).toBe('not_taking_bookings');
    expect(info?.notTakingBookings).toBe(true);
    expect(isTenantNotTakingBookings(info)).toBe(true);
    expect(hasOnlinePaymentRail(info)).toBe(false);
  });
});
