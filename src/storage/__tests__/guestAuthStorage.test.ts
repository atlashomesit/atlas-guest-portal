/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

describe('guestAuthStorage (web path)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('persists OTP JWT session via localStorage', async () => {
    const mod = await import('@/storage/guestAuthStorage');
    const session = {
      isAuthenticated: true,
      token: 'guest-jwt',
      email: 'guest@example.com',
      guestId: 42,
    };
    await mod.persistGuestAuthState(session);
    expect(mod.getCachedGuestAuthState()).toEqual(session);
    expect(localStorage.getItem('atlas_guest_auth')).toContain('guest-jwt');

    await mod.clearGuestAuthState();
    expect(mod.getCachedGuestAuthState()).toBeNull();
  });
});
