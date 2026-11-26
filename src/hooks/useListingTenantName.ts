import { useEffect, useState } from 'react';
import { buildApiUrl } from '../api/client';
import { getTenantContext } from '../tenant/tenantContext';

const publicTenantNameCache = new Map<string, Promise<string | null>>();

/** Read-only marketplace identity. Never replaces the host site's tenant context. */
export function useListingTenantName(slug: string | null) {
  const [resolved, setResolved] = useState<{ slug: string; name: string } | null>(() => {
    if (!slug) return null;
    const ctx = getTenantContext();
    if (ctx && ctx.slug?.toLowerCase() === slug.toLowerCase() && ctx.name?.trim()) {
      return { slug, name: ctx.name.trim() };
    }
    return null;
  });
  useEffect(() => {
    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return;
    const ctx = getTenantContext();
    if (ctx && ctx.slug?.toLowerCase() === slug.toLowerCase() && ctx.name?.trim()) {
      setResolved({ slug, name: ctx.name.trim() });
      return;
    }
    let active = true;
    const key = slug.toLowerCase();
    let req = publicTenantNameCache.get(key);
    if (!req) {
      req = fetch(buildApiUrl(`/tenants/${encodeURIComponent(slug)}/public`), {
        credentials: 'omit',
      })
        .then(async response => {
          if (!response.ok) return null;
          const data: { slug?: string; name?: string } = await response.json();
          if (data.slug?.toLowerCase() === key && typeof data.name === 'string' && data.name.trim()) {
            return data.name.trim();
          }
          return null;
        })
        .catch(() => null);
      publicTenantNameCache.set(key, req);
    }
    void req.then(name => {
      if (active && name) {
        setResolved({ slug, name });
      }
    });
    return () => { active = false; };
  }, [slug]);
  return resolved?.slug === slug ? resolved.name : null;
}
