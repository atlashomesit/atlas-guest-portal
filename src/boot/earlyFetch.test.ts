import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithEarly } from './earlyFetch';
import { loadRuntimeConfig } from '../runtime-config/loader';
import { clearRuntimeConfig } from '../runtime-config';
import { resolveFromDomain } from '../tenant/tenantContext';

/**
 * TASK-10299465 (b): public/boot-prefetch.js starts the runtime-config request and the tenant lookup while the app's scripts download, and the app
 * takes those responses instead of asking again. Measured on a production build: the app asked for the config only after the whole script download
 * had run, then asked for the tenant lookup only after the config answered, two round trips stacked behind the scripts.
 */
const root = path.resolve(import.meta.dirname, '..', '..');
const prefetchSource = readFileSync(path.join(root, 'public', 'boot-prefetch.js'), 'utf8');

const CONFIG_URL = 'https://www.stay.example.com/.well-known/atlas-runtime-config.json';
const TENANT_URL = 'https://api.example.com/tenants/from-domain?domain=stay.example.com';
const tenantBody = { tenantSlug: 'stay-example', brandName: 'Stay Example', isMarketplaceRoot: false };

type FakeWindow = { fetch: typeof fetch; location: Record<string, string>; Capacitor?: { isNativePlatform: () => boolean }; __atlasEarlyFetch?: Record<string, Promise<Response>> };
const makeWindow = (fetchImpl: typeof fetch, extra: Partial<FakeWindow> = {}): FakeWindow => ({
  fetch: fetchImpl,
  location: { protocol: 'https:', origin: 'https://www.stay.example.com', hostname: 'www.stay.example.com' },
  ...extra,
});
// The script is a plain classic script that reads `window`; give it a fake one.
const runPrefetch = (win: FakeWindow) => new Function('window', prefetchSource)(win);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const answers = (calls: string[]) =>
  vi.fn(async (url: string) => {
    calls.push(url);
    if (url.includes('atlas-runtime-config')) {
      // A trailing slash on purpose: the loader strips it, so the prefetch must too or the two tenant URLs would differ.
      return new Response(JSON.stringify({ apiBaseUrl: 'https://api.example.com/', environment: 'test' }), { status: 200 });
    }
    return new Response(JSON.stringify(tenantBody), { status: 200 });
  }) as unknown as typeof fetch;

describe('fetchWithEarly', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('takes the response the prefetch already started, once, and asks normally for everything else', async () => {
    const own = vi.fn(async () => new Response('own'));
    vi.stubGlobal('fetch', own);
    const early = Promise.resolve(new Response('early'));
    vi.stubGlobal('window', { __atlasEarlyFetch: { 'https://x.test/a': early } });

    expect(await (await fetchWithEarly('https://x.test/a')).text()).toBe('early');
    expect(own).not.toHaveBeenCalled();
    // used once: the second ask goes to the network
    expect(await (await fetchWithEarly('https://x.test/a')).text()).toBe('own');
    // a different URL is never answered from the prefetch
    await fetchWithEarly('https://x.test/other');
    expect(own).toHaveBeenCalledTimes(2);
  });

  it('when the script has not run yet, a script that only arrives after the app already asked starts nothing', async () => {
    const own = vi.fn(async () => new Response(JSON.stringify({ apiBaseUrl: 'https://api.example.com' })));
    vi.stubGlobal('fetch', own);
    const win = makeWindow(own as unknown as typeof fetch);
    vi.stubGlobal('window', win);
    await fetchWithEarly('https://x.test/a'); // the app's own request: no map yet
    expect(own).toHaveBeenCalledTimes(1);
    runPrefetch(win); // the late script
    await settle();
    expect(own).toHaveBeenCalledTimes(1);
  });

  it('keeps the one-argument fetch call shape, and passes init through when there is one', async () => {
    const own = vi.fn(async () => new Response('own'));
    vi.stubGlobal('fetch', own);
    vi.stubGlobal('window', {});
    await fetchWithEarly('https://x.test/a');
    expect(own).toHaveBeenLastCalledWith('https://x.test/a');
    await fetchWithEarly('https://x.test/a', { cache: 'no-store' });
    expect(own).toHaveBeenLastCalledWith('https://x.test/a', { cache: 'no-store' });
  });

  it('retries with the app own request when the prefetch failed at the network level, and returns an HTTP error as is', async () => {
    const own = vi.fn(async () => new Response('retry'));
    vi.stubGlobal('fetch', own);
    vi.stubGlobal('window', {
      __atlasEarlyFetch: {
        'https://x.test/down': Promise.reject(new TypeError('Failed to fetch')),
        'https://x.test/missing': Promise.resolve(new Response('nope', { status: 404 })),
      },
    });
    expect(await (await fetchWithEarly('https://x.test/down')).text()).toBe('retry');
    expect(own).toHaveBeenCalledTimes(1);
    const missing = await fetchWithEarly('https://x.test/missing');
    expect(missing.status).toBe(404);
    expect(own).toHaveBeenCalledTimes(1);
  });
});

describe('public/boot-prefetch.js and the app ask for the same two URLs, so each is requested once', () => {
  beforeEach(() => {
    clearRuntimeConfig();
    // The production build is what carries the script, and in production resolveFromDomain asks the absolute API URL.
    vi.stubEnv('DEV', false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearRuntimeConfig();
  });

  it('with the script: the config and the tenant lookup are each fetched exactly once, and the app uses those answers', async () => {
    const calls: string[] = [];
    const fetchImpl = answers(calls);
    const win = makeWindow(fetchImpl);
    vi.stubGlobal('fetch', fetchImpl);
    vi.stubGlobal('window', win);

    runPrefetch(win);
    await settle();
    await settle();
    expect(Object.keys(win.__atlasEarlyFetch ?? {}).sort()).toEqual([CONFIG_URL, TENANT_URL].sort());

    const config = await loadRuntimeConfig();
    expect(config.apiBaseUrl).toBe('https://api.example.com');
    const tenant = await resolveFromDomain(config.apiBaseUrl, win.location.hostname);
    expect(tenant?.slug).toBe('stay-example');

    // two requests in total: the script's. The app asked for neither again.
    expect(calls).toEqual([CONFIG_URL, TENANT_URL]);
    expect(win.__atlasEarlyFetch).toEqual({});
  });

  it('without the script (dev server, blocked, never ran): the app asks for each itself, as before', async () => {
    const calls: string[] = [];
    const fetchImpl = answers(calls);
    const win = makeWindow(fetchImpl);
    vi.stubGlobal('fetch', fetchImpl);
    vi.stubGlobal('window', win);

    const config = await loadRuntimeConfig();
    await resolveFromDomain(config.apiBaseUrl, win.location.hostname.replace('www.', 'plain.'));
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBe(CONFIG_URL);
    expect(calls[1]).toBe('https://api.example.com/tenants/from-domain?domain=plain.stay.example.com');
  });
});

describe('public/boot-prefetch.js never makes things worse', () => {
  it('does nothing in the native app, outside http(s), or when it already ran', () => {
    const fetchImpl = vi.fn(async () => new Response('{}')) as unknown as typeof fetch;
    const native = makeWindow(fetchImpl, { Capacitor: { isNativePlatform: () => true } });
    runPrefetch(native);
    const file = makeWindow(fetchImpl, { location: { protocol: 'file:', origin: 'null', hostname: '' } });
    runPrefetch(file);
    const ran = makeWindow(fetchImpl, { __atlasEarlyFetch: {} });
    runPrefetch(ran);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(native.__atlasEarlyFetch).toBeUndefined();
    expect(file.__atlasEarlyFetch).toBeUndefined();
  });

  it('does not look the tenant up when the config is missing, unreadable or has no usable apiBaseUrl', async () => {
    for (const reply of [
      () => new Response('nope', { status: 404 }),
      () => new Response('not json', { status: 200 }),
      () => new Response(JSON.stringify({ apiBaseUrl: 'not a url' }), { status: 200 }),
      () => new Response(JSON.stringify({}), { status: 200 }),
    ]) {
      const fetchImpl = vi.fn(async () => reply()) as unknown as typeof fetch;
      const win = makeWindow(fetchImpl);
      runPrefetch(win);
      await settle();
      await settle();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(Object.keys(win.__atlasEarlyFetch ?? {})).toEqual([CONFIG_URL]);
    }
  });

  it('a network failure inside the script is swallowed (no throw, no unhandled rejection)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const win = makeWindow(fetchImpl);
    expect(() => runPrefetch(win)).not.toThrow();
    await settle();
    await settle();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('how the script reaches the page', () => {
  const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

  it('is added by the production build only, first in <head>, and never blocks parsing (async)', () => {
    const config = read('vite.config.ts');
    expect(config).toContain('bootPrefetchScriptPlugin()');
    expect(config).toMatch(/apply: "build"/);
    expect(config).toMatch(/src: "\/boot-prefetch\.js", async: true/);
    expect(config).toContain('injectTo: "head-prepend"');
    // index.html stays free of it, so `vite dev` requests and console are unchanged.
    expect(read('index.html')).not.toContain('boot-prefetch');
  });

  it('is a classic script with no inline code (the production CSP has no unsafe-inline) and uses the same cache mode as the loader', () => {
    expect(prefetchSource).toContain('cache: "no-store"');
    expect(read('src/runtime-config/loader.ts')).toContain('cache: "no-store"');
    expect(read('src/runtime-config/loader.ts')).toContain('fetchWithEarly(');
    expect(read('src/tenant/tenantContext.ts')).toContain('fetchWithEarly(url)');
  });
});
