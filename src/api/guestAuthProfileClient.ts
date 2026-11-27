/**
 * GUEST-099: Cross-device server-backed profile client for signed-in returning guests.
 * Uses the guest OTP JWT (`Authorization: Bearer <token>`) to read/update saved
 * contact details, company GSTIN, and read-only masked verified-ID metadata.
 * Never returns or stores raw unmasked government ID numbers.
 */
import { buildApiUrl, getApiHeaders } from '@/api/client';

export interface VerifiedIdSummary {
  govtIdType: string;
  maskedLast4: string;
  verifiedAtUtc?: string | null;
  verificationRef?: string | null;
}

export interface ServerGuestProfile {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  defaultCompanyName?: string | null;
  defaultGstin?: string | null;
  verifiedIdSummary?: VerifiedIdSummary | null;
}

export interface UpdateServerGuestProfileRequest {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  defaultCompanyName?: string | null;
  defaultGstin?: string | null;
}

/**
 * Read the signed-in guest OTP JWT from localStorage.
 * Supports both `atlas_guest_auth` JSON (`{ token | accessToken }`) and `atlas_guest_token`.
 */
export function getGuestAuthToken(): string | null {
  try {
    const direct = window.localStorage.getItem('atlas_guest_token')?.trim();
    if (direct) return direct;
    const rawAuth = window.localStorage.getItem('atlas_guest_auth');
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth) as { token?: string | null; accessToken?: string | null };
      const t = (parsed?.token ?? parsed?.accessToken ?? '').trim();
      if (t) return t;
    }
  } catch {
    // Ignore storage / JSON errors
  }
  return null;
}

function parseVerifiedIdSummary(raw: unknown): VerifiedIdSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const govtIdType = String(obj.govtIdType ?? obj.GovtIdType ?? '').trim();
  const maskedLast4 = String(obj.maskedLast4 ?? obj.MaskedLast4 ?? '').trim();
  if (!govtIdType || !maskedLast4) return null;
  return {
    govtIdType,
    maskedLast4: maskedLast4.slice(-4),
    verifiedAtUtc: typeof (obj.verifiedAtUtc ?? obj.VerifiedAtUtc) === 'string'
      ? String(obj.verifiedAtUtc ?? obj.VerifiedAtUtc)
      : null,
    verificationRef: typeof (obj.verificationRef ?? obj.VerificationRef) === 'string'
      ? String(obj.verificationRef ?? obj.VerificationRef)
      : null,
  };
}

function normalizeServerGuestProfile(raw: Record<string, unknown>): ServerGuestProfile {
  const str = (camel: string, pascal: string): string | null => {
    const v = raw[camel] ?? raw[pascal];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  return {
    name: str('name', 'Name'),
    email: str('email', 'Email'),
    phone: str('phone', 'Phone'),
    nationality: str('nationality', 'Nationality'),
    defaultCompanyName: str('defaultCompanyName', 'DefaultCompanyName'),
    defaultGstin: str('defaultGstin', 'DefaultGstin'),
    verifiedIdSummary: parseVerifiedIdSummary(raw.verifiedIdSummary ?? raw.VerifiedIdSummary),
  };
}

/**
 * Fetch the signed-in guest's server-backed profile (`GET /api/guest-auth/profile`).
 * Returns null if not signed in or if the endpoint is unavailable (graceful degradation).
 */
export async function fetchSignedInGuestProfile(signal?: AbortSignal): Promise<ServerGuestProfile | null> {
  const token = getGuestAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(buildApiUrl('/api/guest-auth/profile'), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...getApiHeaders(),
      },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return normalizeServerGuestProfile(data);
  } catch {
    return null;
  }
}

/**
 * Update the signed-in guest's server-backed profile (`PUT /api/guest-auth/profile`).
 */
export async function updateSignedInGuestProfile(
  payload: UpdateServerGuestProfileRequest,
): Promise<ServerGuestProfile> {
  const token = getGuestAuthToken();
  if (!token) {
    throw new Error('Sign in required to update your saved profile.');
  }
  const res = await fetch(buildApiUrl('/api/guest-auth/profile'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...getApiHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Profile update failed (${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeServerGuestProfile(data);
}
