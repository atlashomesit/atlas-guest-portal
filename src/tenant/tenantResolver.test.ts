import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTenantSlugFromHostname,
  getTenantSlug,
  isAtlastaysMarketplaceSurface,
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
    it('returns null (tenant is not derived from subdomain)', () => {
      setHostname('contoso.atlashomestays.com');
      expect(getTenantSlugFromHostname()).toBeNull();
    });
  });

  describe('getTenantSlug', () => {
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

  describe('isAtlastaysMarketplaceSurface', () => {
    it('returns true for local dev hosts in development mode', () => {
      setHostname('127.0.0.1');
      expect(isAtlastaysMarketplaceSurface()).toBe(true);
    });

    it('returns true for marketplace apex domains', () => {
      setHostname('www.atlastays.com');
      expect(isAtlastaysMarketplaceSurface()).toBe(true);
    });

    it('returns false for non-marketplace custom domains without brand param', () => {
      setHostname('e2e-manual.localhost');
      expect(isAtlastaysMarketplaceSurface()).toBe(false);
    });
  });
});
