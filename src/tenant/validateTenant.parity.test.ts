import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTenantContext, validateTenant } from './tenantContext';
import { hasOnlinePaymentRail } from './paymentRail';

describe('TASK-1040214: validateTenant() preserves payment, contact, and lifecycle fields', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves ONLINE Razorpay, WhatsApp phone, UPI, and lifecycle fields from /tenants/{slug}/public', async () => {
    const slug = `qa-bot-online-${Date.now()}`;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 42,
          name: 'QA Bot Homestay',
          slug,
          bookingMode: 'ONLINE',
          paymentProvider: 'RAZORPAY',
          whatsappBookingPhone: '919444623544',
          displayMerchantName: 'QA Bot Stays',
          upiVpa: 'qabot@upi',
          upiQrAssetUrl: 'https://cdn.example.com/qr.png',
          upiInstructions: 'Pay via UPI',
          lifecycleStage: 'Active',
          websiteStatus: 'live',
          onlinePaymentsEnabled: true,
          notTakingBookings: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const info = await validateTenant(slug);
    expect(info.bookingMode).toBe('ONLINE');
    expect(info.paymentProvider).toBe('RAZORPAY');
    expect(info.whatsappBookingPhone).toBe('919444623544');
    expect(info.displayMerchantName).toBe('QA Bot Stays');
    expect(info.upiVpa).toBe('qabot@upi');
    expect(info.upiQrAssetUrl).toBe('https://cdn.example.com/qr.png');
    expect(info.upiInstructions).toBe('Pay via UPI');
    expect(info.lifecycleStage).toBe('Active');
    expect(info.websiteStatus).toBe('live');
    expect(info.onlinePaymentsEnabled).toBe(true);
    expect(info.notTakingBookings).toBe(false);
    expect(hasOnlinePaymentRail(getTenantContext())).toBe(true);
  });

  it('derives Trial and Blocked lifecycle flags identically to resolveFromDomain()', async () => {
    const trialSlug = `qa-bot-trial-${Date.now()}`;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 43,
          name: 'Trial Stay',
          slug: trialSlug,
          bookingMode: 'WHATSAPP',
          lifecycleStage: 'Trial',
          websiteStatus: 'live',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const trialInfo = await validateTenant(trialSlug);
    expect(trialInfo.onlinePaymentsEnabled).toBe(false);
    expect(trialInfo.notTakingBookings).toBe(false);

    const blockedSlug = `qa-bot-blocked-${Date.now()}`;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 44,
          name: 'Blocked Stay',
          slug: blockedSlug,
          bookingMode: 'BLOCKED_LIFECYCLE',
          lifecycleStage: 'Blocked',
          websiteStatus: 'not_taking_bookings',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const blockedInfo = await validateTenant(blockedSlug);
    expect(blockedInfo.bookingMode).toBe('BLOCKED_LIFECYCLE');
    expect(blockedInfo.notTakingBookings).toBe(true);
    expect(hasOnlinePaymentRail(getTenantContext())).toBe(false);
  });
});
