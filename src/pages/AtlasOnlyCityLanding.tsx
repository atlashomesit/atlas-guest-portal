import { Navigate } from "react-router-dom";

import { type CityLandingSlug } from "@/content/cities/cityLandingSlugs";
import { getTenantContext } from "@/tenant/tenantContext";
import { getTenantOverrides, shouldHideAtlasBranding } from "@/tenant/tenantOverrides";

import CityLandingPage from "./CityLandingPage";

export type AtlasOnlyCityLandingProps = {
  citySlug: CityLandingSlug;
};

/**
 * TASK-7194: `/homestays-in-{city}` SEO guides are Atlas marketplace content only.
 * White-label tenant domains must not serve Hyderabad/Goa guides for unrelated inventory.
 */
export default function AtlasOnlyCityLanding({ citySlug }: AtlasOnlyCityLandingProps) {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  if (shouldHideAtlasBranding(tenant, overrides)) {
    return <Navigate to="/" replace />;
  }
  return <CityLandingPage citySlug={citySlug} />;
}
