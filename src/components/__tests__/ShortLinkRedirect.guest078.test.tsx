import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShortLinkRedirect from '../ShortLinkRedirect';
import { settle } from '../../test/settle';

describe('ShortLinkRedirect (GUEST-078)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('falls back to /tenants/{slug}/public and resolves to /?tenant=slug when tenant has zero listings', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/public/listings')) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
        };
      }
      if (url.includes('/tenants/new-host/public')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ slug: 'new-host', name: 'New Host Homestay' }),
        };
      }
      return {
        ok: false,
        status: 404,
      };
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <MemoryRouter initialEntries={['/new-host']}>
        <Routes>
          <Route path="/:shortCode" element={<ShortLinkRedirect />} />
        </Routes>
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByText('/?tenant=new-host')).toBeInTheDocument();

    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.endsWith('/tenants/new-host/public'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('/tenants/public/new-host'))).toBe(false);
  });
});
