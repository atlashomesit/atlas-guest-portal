import { useEffect, useState } from 'react';
import { buildApiUrl } from '../api/client';

/** Read-only marketplace identity. Never replaces the host site's tenant context. */
export function useListingTenantName(slug: string | null) {
  const [resolved, setResolved] = useState<{ slug: string; name: string } | null>(null);
  useEffect(() => {
    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return;
    const controller = new AbortController();
    let active = true;
    void fetch(buildApiUrl(`/tenants/${encodeURIComponent(slug)}/public`), {
      signal: controller.signal, credentials: 'omit',
    }).then(async response => {
      if (!response.ok) return;
      const data: { slug?: string; name?: string } = await response.json();
      if (active && data.slug === slug && typeof data.name === 'string' && data.name.trim()) {
        setResolved({ slug, name: data.name.trim() });
      }
    }).catch(() => { /* Listing identity remains honest when public lookup is unavailable. */ });
    return () => { active = false; controller.abort(); };
  }, [slug]);
  return resolved?.slug === slug ? resolved.name : null;
}
