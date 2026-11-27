import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSignedInGuestProfile,
  getGuestAuthToken,
  updateSignedInGuestProfile,
} from './guestAuthProfileClient';

describe('GUEST-099: guestAuthProfileClient', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('reads guest JWT from atlas_guest_auth JSON or atlas_guest_token', () => {
    expect(getGuestAuthToken()).toBeNull();
    window.localStorage.setItem('atlas_guest_auth', JSON.stringify({ token: 'jwt-abc-123' }));
    expect(getGuestAuthToken()).toBe('jwt-abc-123');
    window.localStorage.setItem('atlas_guest_token', 'jwt-direct-456');
    expect(getGuestAuthToken()).toBe('jwt-direct-456');
  });

  it('fetchSignedInGuestProfile returns null when unsigned without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await fetchSignedInGuestProfile();
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetchSignedInGuestProfile returns normalized profile with company GSTIN and masked verified ID', async () => {
    window.localStorage.setItem('atlas_guest_auth', JSON.stringify({ token: 'guest-jwt-99' }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: 'Aarav Sharma',
          email: 'aarav@example.com',
          phone: '+919876543210',
          nationality: 'India',
          defaultCompanyName: 'Acme Stays Pvt Ltd',
          defaultGstin: '29ABCDE1234F1Z5',
          verifiedIdSummary: {
            govtIdType: 'Aadhaar',
            maskedLast4: '4321',
            verifiedAtUtc: '2026-10-01T10:00:00Z',
            verificationRef: 'ver-ref-001',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const profile = await fetchSignedInGuestProfile();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/guest-auth/profile');
    expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer guest-jwt-99');

    expect(profile).toEqual({
      name: 'Aarav Sharma',
      email: 'aarav@example.com',
      phone: '+919876543210',
      nationality: 'India',
      defaultCompanyName: 'Acme Stays Pvt Ltd',
      defaultGstin: '29ABCDE1234F1Z5',
      verifiedIdSummary: {
        govtIdType: 'Aadhaar',
        maskedLast4: '4321',
        verifiedAtUtc: '2026-10-01T10:00:00Z',
        verificationRef: 'ver-ref-001',
      },
    });
  });

  it('updateSignedInGuestProfile sends PUT with Bearer token', async () => {
    window.localStorage.setItem('atlas_guest_token', 'guest-jwt-put');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: 'Aarav Sharma',
          defaultCompanyName: 'Acme Stays Pvt Ltd',
          defaultGstin: '29ABCDE1234F1Z5',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const updated = await updateSignedInGuestProfile({
      defaultCompanyName: 'Acme Stays Pvt Ltd',
      defaultGstin: '29ABCDE1234F1Z5',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.method).toBe('PUT');
    expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer guest-jwt-put');
    expect(updated.defaultGstin).toBe('29ABCDE1234F1Z5');
  });
});
