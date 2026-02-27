import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  resetAnalyticsTransport,
  setAnalyticsTransport,
  trackEvent,
  type AnalyticsEventPayload,
} from './analytics';

describe('analytics', () => {
  afterEach(() => {
    resetAnalyticsTransport();
    vi.clearAllMocks();
  });

  it('enriches events with env, route, and timestamp', () => {
    const payload = trackEvent('home_view');

    expect(payload.event).toBe('home_view');
    expect(payload.env === 'dev' || payload.env === 'prod').toBe(true);
    expect(payload.timestamp).toBeDefined();
  });

  it('allows overriding the transport', () => {
    const spy = vi.fn();
    setAnalyticsTransport(spy);

    const result = trackEvent(
      'listing_selected',
      { source: 'test' },
      { listingId: '123', route: '/property_details/123' },
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const dispatched: AnalyticsEventPayload = spy.mock.calls[0][0];
    expect(dispatched.listingId).toBe('123');
    expect(dispatched.route).toBe('/property_details/123');
    expect(result.event).toBe('listing_selected');
  });

  it('falls back safely if transport throws', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

    setAnalyticsTransport(() => {
      throw new Error('network down');
    });

    const payload = trackEvent('reserve_click', { attempt: 1 });

    expect(payload.event).toBe('reserve_click');
    expect(consoleWarn).toHaveBeenCalled();
    expect(consoleInfo).toHaveBeenCalled();

    consoleWarn.mockRestore();
    consoleInfo.mockRestore();
  });
});
