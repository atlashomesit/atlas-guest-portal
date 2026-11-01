import React, { Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { cityGuidePath } from "@/content/cities/cityDirectory";
import type { CityLandingSlug } from "@/content/cities/cityLandingSlugs";
import { isAtlastaysMarketplaceSurface, isMarketplaceMode } from "@/tenant/tenantResolver";

const ShortLinkRedirect = React.lazy(() => import("./ShortLinkRedirect"));

export type CityVanityRedirectProps = {
  citySlug: CityLandingSlug;
};

/**
 * MKT-034: `atlastays.com/coorg` (a naked city slug) used to fall into the `/:shortCode` catch-all and 404.
 * On the Atlas marketplace surface it now redirects to the city guide `/homestays-in-coorg`, keeping the query string
 * and hash so campaign attribution (`?utm_*`) survives.
 *
 * Everywhere else (a white-label tenant domain, or a tenant link such as `/coorg` meaning a host's own slug) the path keeps
 * the behaviour it always had: the `/:shortCode` resolver, handed this slug.
 */
export default function CityVanityRedirect({ citySlug }: CityVanityRedirectProps) {
  const location = useLocation();

  if (isMarketplaceMode() && isAtlastaysMarketplaceSurface()) {
    return <Navigate to={`${cityGuidePath(citySlug)}${location.search}${location.hash}`} replace />;
  }

  return (
    <Suspense fallback={null}>
      <ShortLinkRedirect code={citySlug} />
    </Suspense>
  );
}
