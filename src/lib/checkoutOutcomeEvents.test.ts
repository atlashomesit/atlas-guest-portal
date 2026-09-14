import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  buildApiUrl: (p: string) => `https://api.test${p}`,
  getApiHeaders: () => ({ 'X-Tenant-Slug': 'test-tenant' }),
}));

import { TerminalCheckoutOutcomeEvents, track } from './events';

const ALLOWED_BODY_KEYS = ['eventName', 'listingId', 'sessionId'];

describe('TASK-10087 terminal checkout outcomes', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('atlas_session_id', 'test-session-id');
    vi.restoreAllMocks();
  });

  it('fixes the five anonymous wire names', () => {
    expect({ ...TerminalCheckoutOutcomeEvents }).toEqual({
      PaymentModalDismissed: 'payment_modal_dismissed',
      PaymentFailed: 'payment_failed',
      HoldExpiredDuringPayment: 'hold_expired_during_payment',
      ChargedUnconfirmed: 'charged_unconfirmed',
      PaymentConfirmed: 'payment_confirmed',
    });
  });

  it('posts anonymous identifiers only — no PII, payment, or free-text fields', () => {
    const mock = vi.fn(() => Promise.resolve(new Response('{}', { status: 204 })));
    vi.stubGlobal('fetch', mock);

    track(TerminalCheckoutOutcomeEvents.PaymentModalDismissed, 42);

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://api.test/api/funnel-events');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(ALLOWED_BODY_KEYS);
    expect(body).toEqual({
      eventName: 'payment_modal_dismissed',
      sessionId: 'test-session-id',
      listingId: 42,
    });
  });

  it('sends null listingId when none is known, still with no extra fields', () => {
    const mock = vi.fn(() => Promise.resolve(new Response('{}', { status: 204 })));
    vi.stubGlobal('fetch', mock);

    track(TerminalCheckoutOutcomeEvents.PaymentFailed);

    const [, init] = mock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(ALLOWED_BODY_KEYS);
    expect(body.listingId).toBeNull();
  });
});
