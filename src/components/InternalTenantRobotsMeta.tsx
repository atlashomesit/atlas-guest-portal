import { useEffect } from 'react';
import { getInternalTenantRobots } from '@/tenant/tenantContext';

/**
 * TASK-4386: applies `noindex, nofollow` on every route when the resolved tenant is internal.
 * Complements per-page `<SEO robots=…>` (draft listings); internal tenants always noindex.
 */
export default function InternalTenantRobotsMeta() {
  useEffect(() => {
    const robots = getInternalTenantRobots();
    const managedRobots = document.head.querySelector(
      'meta[data-internal-tenant-robots]',
    ) as HTMLMetaElement | null;

    if (robots) {
      const meta = managedRobots ?? document.createElement('meta');
      meta.setAttribute('name', 'robots');
      meta.setAttribute('data-internal-tenant-robots', 'true');
      meta.content = robots;
      if (!managedRobots) document.head.appendChild(meta);
    } else if (managedRobots) {
      managedRobots.remove();
    }
  });

  return null;
}
