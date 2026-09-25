import { describe, it, expect } from 'vitest';
import { daysUntilExpiry, sslAlertCopy, sslRenewalStatus } from './sslExpiry';

/** TASK-102419 — SSL renewal must surface before guests see a privacy warning. */
describe('sslExpiry — TASK-102419 renewal health', () => {
  const now = new Date('2026-09-01T00:00:00Z');

  it('computes whole days until expiry', () => {
    expect(daysUntilExpiry('2026-09-15T00:00:00Z', now)).toBe(14);
    expect(daysUntilExpiry('2026-08-30T00:00:00Z', now)).toBe(-2);
    expect(daysUntilExpiry(null, now)).toBeNull();
    expect(daysUntilExpiry('not-a-date', now)).toBeNull();
  });

  it('warns 14 days out, escalates to urgent at 3 days or on renewal failure', () => {
    expect(sslRenewalStatus('2026-09-15T00:00:00Z', false, now)).toBe('warning');
    expect(sslRenewalStatus('2026-09-04T00:00:00Z', false, now)).toBe('urgent');
    expect(sslRenewalStatus('2026-10-01T00:00:00Z', true, now)).toBe('urgent');
    expect(sslRenewalStatus('2026-10-01T00:00:00Z', false, now)).toBe('healthy');
    expect(sslRenewalStatus('2026-08-30T00:00:00Z', false, now)).toBe('expired');
  });

  it('emits alert copy only for actionable states', () => {
    expect(sslAlertCopy('healthy', 'stays.villashanti.com')).toBeNull();
    expect(sslAlertCopy('unknown', 'stays.villashanti.com')).toBeNull();
    expect(sslAlertCopy('warning', 'stays.villashanti.com')).toContain('stays.villashanti.com');
    expect(sslAlertCopy('expired', 'stays.villashanti.com')).toContain('expired');
  });
});
