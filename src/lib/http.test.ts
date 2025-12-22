import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('apiFetch', () => {
  it('prefixes base for relative paths in prod', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.test');
    vi.resetModules();
    const { apiFetch } = await import('./http');
    const mock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', mock);
    await apiFetch('/foo');
    expect(mock).toHaveBeenCalledWith('https://api.test/foo', expect.objectContaining({ credentials: 'include' }));
  });

  it('blocks localhost on non-local host', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.test');
    vi.stubEnv('DEV', 'false');
    vi.resetModules();
    const { apiFetch } = await import('./http');
    await expect(apiFetch('http://localhost:1234')).rejects.toThrow();
  });
});
