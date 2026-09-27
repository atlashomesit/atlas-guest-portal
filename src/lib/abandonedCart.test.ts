import { describe, it, expect } from 'vitest';
import { cartRestoreUrl, isRecoveryDue, hasRecoveryContact } from './abandonedCart';

describe('TASK-102261 abandoned-cart recovery', () => {
  it('requires a step-1 contact before any nudge', () => {
    expect(hasRecoveryContact({})).toBe(false);
    expect(hasRecoveryContact({ mobile: '+919876543210' })).toBe(true);
  });

  it('fires the nudge only after 30 minutes on unfinalized carts', () => {
    const base = { cartId: 'c1', contact: { mobile: '+919876543210' }, step1CompletedAtMs: 0, finalized: false };
    expect(isRecoveryDue(base, 29 * 60_000)).toBe(false);
    expect(isRecoveryDue(base, 30 * 60_000)).toBe(true);
    expect(isRecoveryDue({ ...base, finalized: true }, 60 * 60_000)).toBe(false);
  });

  it('builds a 1-click cart restoration deep link', () => {
    expect(cartRestoreUrl('https://stays.example.com/', 'c1')).toBe('https://stays.example.com/book/restore?cart=c1');
  });
});
