import { getRuntimeConfig, hasRuntimeConfig, isProductionEnvironment } from '@/runtime-config';
import { getTenantSlug, isMarketplaceMode } from './tenantResolver';

/**
 * TASK-1040055 (tenant isolation): the one rule for `?tenant=<slug>`.
 *
 * `?tenant=` exists for the MARKETPLACE: a listing card from another host opens with the host's slug so the page reads that host's data. On a host's OWN site (a hostname that resolved
 * to a tenant) it used to change whose data the API calls read (X-Tenant-Slug) while the page chrome (brand, footer contact, checkout support line) still came from the host tenant, so a guest
 * of one tenant could be shown another tenant's name, phone and e-mail beside the data of a third.
 *
 * Honoured when: the marketplace is showing (cross-host listings), or the host resolved to no tenant, or it names the same tenant, or the environment is a NON-production one (qa, dev,
 * staging, local) where the shared host maps to one tenant and E2E loads a fresh test tenant through the parameter. Anything else, and every unknown environment, is ignored: the host's tenant wins.
 */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export interface UrlTenantInput {
  urlSlug: string | null | undefined;
  domainSlug: string | null | undefined;
  marketplaceMode: boolean;
  environment: string | null | undefined;
}

export function sanitizeUrlTenantSlug(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toLowerCase();
  return SLUG.test(s) ? s : null;
}

/** Production is "prod"/"production" and, fail safe, an empty or missing environment (the same single source of truth the indexing rule uses). */
function isNonProduction(environment: string | null | undefined): boolean {
  return !isProductionEnvironment(environment);
}

/** The `?tenant=` slug that may change whose data is read, or null when the host's tenant wins. */
export function resolveHonoredUrlTenant(input: UrlTenantInput): string | null {
  const url = sanitizeUrlTenantSlug(input.urlSlug);
  if (!url) return null;
  if (url === 'marketplace') return url;
  if (input.marketplaceMode) return url;
  const host = sanitizeUrlTenantSlug(input.domainSlug);
  if (!host || host === 'marketplace') return url;
  if (url === host) return url;
  return isNonProduction(input.environment) ? url : null;
}

/** True when a honoured `?tenant=` names a tenant other than the one the host resolved to (so the host tenant's own contact must not stand in for it). */
export function isUrlTenantOverridingHost(input: UrlTenantInput): boolean {
  const honored = resolveHonoredUrlTenant(input);
  const host = sanitizeUrlTenantSlug(input.domainSlug);
  return Boolean(honored && host && host !== 'marketplace' && honored !== host && !input.marketplaceMode);
}

function runtimeEnvironment(): string | undefined {
  try {
    return hasRuntimeConfig() ? (getRuntimeConfig() as { environment?: string }).environment : undefined;
  } catch {
    return undefined;
  }
}

/** Reads the live page: the `?tenant=` of the current URL, the host's resolved slug, the marketplace flag and the runtime environment. */
export function currentUrlTenantInput(): UrlTenantInput {
  const urlSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null;
  return {
    urlSlug,
    domainSlug: getTenantSlug(),
    marketplaceMode: isMarketplaceMode(),
    environment: runtimeEnvironment(),
  };
}
