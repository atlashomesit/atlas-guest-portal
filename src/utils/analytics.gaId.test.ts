import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initTenantAnalytics,
  resetAnalyticsForTests,
  resetAnalyticsTransport,
  sanitizeGaMeasurementId,
  trackEvent,
} from './analytics';

/**
 * TASK-102427 — a host-entered GA measurement ID must actually track pageviews, and
 * the injection must be sanitized (no escaped-entity tag can break execution).
 */
describe('analytics — TASK-102427 GA ID injection', () => {
  beforeEach(() => {
    resetAnalyticsForTests();
    window.localStorage.setItem('atlas_cookie_consent', 'all');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
  });

  afterEach(() => {
    document.head.querySelectorAll('#gtag-js').forEach((el) => el.remove());
    window.localStorage.removeItem('atlas_cookie_consent');
    resetAnalyticsForTests();
    resetAnalyticsTransport();
    vi.unstubAllGlobals();
  });

  it('accepts a strict GA4 ID and rejects injection-shaped input', () => {
    expect(sanitizeGaMeasurementId('G-XXXXXXXXXX')).toBe('G-XXXXXXXXXX');
    expect(sanitizeGaMeasurementId('G-ABC123')).toBe('G-ABC123');
    expect(sanitizeGaMeasurementId('G-ABC123&amp;foo')).toBeNull();
    expect(sanitizeGaMeasurementId('<script>G-ABC123</script>')).toBeNull();
    expect(sanitizeGaMeasurementId('UA-12345-1')).toBeNull();
    expect(sanitizeGaMeasurementId('')).toBeNull();
    expect(sanitizeGaMeasurementId(null)).toBeNull();
    expect(sanitizeGaMeasurementId('G-AB"C')).toBeNull();
  });

  it('wires pageviews to gtag via DOM injection (no innerHTML) once cookies are accepted', () => {
    const gtagSpy = vi.fn();
    (window as unknown as { gtag: unknown }).gtag = gtagSpy;

    initTenantAnalytics('G-TEST12345');
    trackEvent('page_view', { surface: 'router' }, { route: '/homes/villa/1' });

    expect(gtagSpy).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({}));
    const script = document.head.querySelector('#gtag-js');
    expect(script?.getAttribute('src')).toContain('G-TEST12345');
  });

  it('does nothing for a rejected ID (no script, no crash)', () => {
    initTenantAnalytics('G-BAD&lt;script&gt;');
    expect(document.head.querySelector('#gtag-js')).toBeNull();
  });
});
