import { describe, it, expect, vi, afterEach } from 'vitest';
import { onRequest } from './manifest.webmanifest';

const req = (url: string) => ({ request: new Request(url), env: {} }) as never;

describe('manifest.webmanifest (TASK-102425)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves the static-equivalent fallback for first-party hosts without an API call', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('must not fetch');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const res = (await onRequest(req('https://atlashomestays.com/'))) as Response;
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe('Atlastays');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the tenant brand for a rewrite-eligible host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          tenantSlug: 'royal-oak',
          propertyName: 'Royal Oak Stays',
          description: 'Lakeside villas',
          photoUrl: 'https://cdn.example/royal.png',
          canonicalUrl: 'https://royal.example/',
        }),
      })) as never,
    );
    const res = (await onRequest({
      request: new Request('https://stay.royaloak.example/'),
      env: { ATLAS_API_BASE_URL: 'https://api.example' },
    } as never)) as Response;
    const body = (await res.json()) as { name: string; short_name: string };
    expect(body.name).toBe('Royal Oak Stays');
    expect(body.short_name).toBe('Royal Oak St');
  });

  it('fails open to the static manifest when the API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })) as never,
    );
    const res = (await onRequest({
      request: new Request('https://stay.royaloak.example/'),
      env: { ATLAS_API_BASE_URL: 'https://api.example' },
    } as never)) as Response;
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe('Atlastays');
  });
});
