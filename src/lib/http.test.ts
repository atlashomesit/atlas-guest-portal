import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(async () => {
  const runtime = await import('@/runtime-config');
  runtime.clearRuntimeConfig();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('apiFetch', () => {
  it('prefixes base for relative paths when running off localhost', async () => {
    vi.doMock('@/config/env', () => ({ IS_LOCALHOST: false }));
    const runtime = await import('@/runtime-config');
    runtime.setRuntimeConfig({ apiBaseUrl: 'https://api.test' });

    const { apiFetch } = await import('./http');
    const mock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', mock);

    await apiFetch('/foo');

    expect(mock).toHaveBeenCalledWith('https://api.test/foo', expect.objectContaining({ credentials: 'omit' }));
  });

  it('blocks localhost absolute URLs when running off localhost', async () => {
    vi.doMock('@/config/env', () => ({ IS_LOCALHOST: false }));
    const runtime = await import('@/runtime-config');
    runtime.setRuntimeConfig({ apiBaseUrl: 'https://api.test' });

    const { apiFetch } = await import('./http');

    await expect(apiFetch('http://localhost:1234')).rejects.toThrow('Refusing localhost request');
  });
});
