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
    it('returns null for bare domain atlashomestays.com (marketplace/landing)', () => {
      setHostname('atlashomestays.com');
      expect(getTenantSlugFromHostname()).toBeNull();
    });

    it('returns subdomain when hostname is contoso.atlashomestays.com', () => {
      setHostname('contoso.atlashomestays.com');
      expect(getTenantSlugFromHostname()).toBe('contoso');
    });

    it('returns subdomain for sunrise.atlashomestays.com', () => {
      setHostname('sunrise.atlashomestays.com');
      expect(getTenantSlugFromHostname()).toBe('sunrise');
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
      expect(getTenantSlugFromHostname()).toBeNull();
    });
  });

  describe('getTenantSlug', () => {
    it('returns subdomain from hostname', () => {
      setHostname('contoso.atlashomestays.com');
      expect(getTenantSlug()).toBe('contoso');
    });

    it('returns null for bare domain (no default)', () => {
      setHostname('atlashomestays.com');
      expect(getTenantSlug()).toBeNull();
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
