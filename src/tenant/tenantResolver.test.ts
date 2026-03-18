import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTenantSlugFromHostname,
  getTenantSlug,
  isLocalDev,
} from './tenantResolver';

type WindowWithHostname = { location: { hostname: string } };

function setHostname(hostname: string): void {
  (globalThis.window as WindowWithHostname).location.hostname = hostname;
}

describe('tenantResolver', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { hostname: '' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getTenantSlugFromHostname', () => {
<<<<<<< HEAD
    it('returns "atlas" when hostname is atlashomestays.com', () => {
      setHostname('atlashomestays.com');
      expect(getTenantSlugFromHostname()).toBe('atlas');
    });

    it('returns subdomain when hostname is contoso.atlashomestays.com', () => {
      setHostname('contoso.atlashomestays.com');
      expect(getTenantSlugFromHostname()).toBe('contoso');
    });

    it('returns "atlas" when subdomain is empty (atlashomestays.com with leading dot)', () => {
      setHostname('atlashomestays.com');
      expect(getTenantSlugFromHostname()).toBe('atlas');
    });

    it('returns null when hostname is localhost', () => {
      setHostname('localhost');
      expect(getTenantSlugFromHostname()).toBeNull();
    });

    it('returns null when hostname is 127.0.0.1', () => {
      setHostname('127.0.0.1');
      expect(getTenantSlugFromHostname()).toBeNull();
    });

    it('returns null when hostname is something else (e.g. example.com)', () => {
      setHostname('example.com');
=======
    it('returns null (tenant is not derived from subdomain)', () => {
      setHostname('contoso.atlashomestays.com');
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
      expect(getTenantSlugFromHostname()).toBeNull();
    });
  });

  describe('getTenantSlug', () => {
<<<<<<< HEAD
    it('uses hostname when it resolves (atlashomestays.com)', () => {
      setHostname('atlashomestays.com');
      expect(getTenantSlug()).toBe('atlas');
    });

    it('uses fallbackSlug when hostname does not resolve (localhost)', () => {
      setHostname('localhost');
      expect(getTenantSlug({ fallbackSlug: 'dev-tenant' })).toBe('dev-tenant');
    });

    it('returns null when hostname does not resolve and no fallback', () => {
      setHostname('localhost');
      expect(getTenantSlug()).toBeNull();
    });

    it('trims fallback slug', () => {
      setHostname('localhost');
=======
    it('returns only fallbackSlug from config (hostname ignored)', () => {
      setHostname('dev.atlashomestays.com');
      expect(getTenantSlug()).toBeNull();
      expect(getTenantSlug({ fallbackSlug: 'atlas' })).toBe('atlas');
    });

    it('returns null when no fallback', () => {
      setHostname('atlashomestays.com');
      expect(getTenantSlug()).toBeNull();
    });

    it('uses fallbackSlug from runtime config', () => {
      expect(getTenantSlug({ fallbackSlug: 'dev-tenant' })).toBe('dev-tenant');
    });

    it('returns null when fallback is empty', () => {
      expect(getTenantSlug()).toBeNull();
      expect(getTenantSlug({ fallbackSlug: '' })).toBeNull();
    });

    it('trims fallback slug', () => {
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
      expect(getTenantSlug({ fallbackSlug: '  my-tenant  ' })).toBe('my-tenant');
    });
  });

  describe('isLocalDev', () => {
    it('returns true for localhost', () => {
      setHostname('localhost');
      expect(isLocalDev()).toBe(true);
    });

    it('returns true for 127.0.0.1', () => {
      setHostname('127.0.0.1');
      expect(isLocalDev()).toBe(true);
    });

    it('returns false for atlashomestays.com', () => {
      setHostname('atlashomestays.com');
      expect(isLocalDev()).toBe(false);
    });
  });
});
