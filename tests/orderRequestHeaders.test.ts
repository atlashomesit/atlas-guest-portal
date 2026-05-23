import { describe, expect, it, vi } from 'vitest';

// Deterministic tenant/runtime so getApiHeaders() yields a stable X-Tenant-Slug in the unit env.
vi.mock('@/runtime-config', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
  hasRuntimeConfig: () => true,
  getRuntimeConfig: () => ({ tenantKey: 'atlas' }),
}));
vi.mock('@/tenant/tenantResolver', () => ({
  getTenantSlug: () => 'atlas',
}));

import { CORS_ALLOWED_REQUEST_HEADERS, getOrderRequestHeaders } from '@/api/client';

// Guards the booking money-path: every header the client attaches to POST /api/Razorpay/order must be
// permitted by the API's CORS allow-list, or the browser preflight fails and checkout breaks with an
// axios "Network Error". CORS_ALLOWED_REQUEST_HEADERS mirrors atlas-api's DynamicCorsMiddleware.
// HttpClient-based API tests can't catch this (they don't enforce CORS), so this is the cheap guard.
describe('order request headers <-> CORS contract', () => {
  // 'accept'/'accept-language'/'content-language' are CORS-safelisted and need no server allow-entry.
  const SAFELISTED = ['accept', 'accept-language', 'content-language'];
  const permitted = new Set([
    ...CORS_ALLOWED_REQUEST_HEADERS.map((h) => h.toLowerCase()),
    ...SAFELISTED,
  ]);

  it('sends only headers the API CORS layer permits', () => {
    const headers = getOrderRequestHeaders('test-idempotency-key');
    for (const name of Object.keys(headers)) {
      expect(
        permitted.has(name.toLowerCase()),
        `Order request sends "${name}", which is not in CORS_ALLOWED_REQUEST_HEADERS. Add it there AND to atlas-api DynamicCorsMiddleware, or the browser preflight will block checkout.`,
      ).toBe(true);
    }
  });

  it('carries the Idempotency-Key, and that header is allow-listed (regression for the booking outage)', () => {
    const headers = getOrderRequestHeaders('idem-123');
    expect(headers['Idempotency-Key']).toBe('idem-123');
    expect(CORS_ALLOWED_REQUEST_HEADERS.map((h) => h.toLowerCase())).toContain('idempotency-key');
  });
});
