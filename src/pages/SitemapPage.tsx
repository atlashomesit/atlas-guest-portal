import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { getTenantBrandName } from "../tenant/displayBrand";
import { CITY_LANDING_SLUGS } from "../content/cities/cityLandingSlugs";
import { getTenantContext } from "../tenant/tenantContext";
import { getTenantOverrides, shouldHideAtlasBranding } from "../tenant/tenantOverrides";

// TASK-4308: human-readable sitemap page. Mirrors functions/sitemap.xml.ts's
// CORE_PATHS list so the two don't silently drift — if you add a path here,
// add it there too (and vice versa). The XML sitemap at /sitemap.xml stays
// live for crawlers; this page is for people.
const SHARED_SITEMAP_LINKS: { label: string; path: string }[] = [
  { label: "Home", path: "/" },
  { label: "Amenities", path: "/amenities" },
  { label: "Location", path: "/location" },
  { label: "Gallery", path: "/gallery" },
  { label: "Offers", path: "/offers" },
  { label: "Blog", path: "/blog" },
  { label: "Guest Guides", path: "/blog/guest-guides" },
  { label: "Hospitality Tech", path: "/blog/hospitality-tech" },
  { label: "Policies", path: "/policies" },
  { label: "Contact", path: "/contact" },
  { label: "About", path: "/about" },
  { label: "FAQ", path: "/faq" },
  { label: "Terms", path: "/terms" },
];

const ATLAS_CITY_LINKS = CITY_LANDING_SLUGS.map((slug) => ({
  label: `Homestays in ${slug.charAt(0).toUpperCase()}${slug.slice(1)}`,
  path: `/homestays-in-${slug}`,
}));

const SitemapPage = () => {
  const brandName = getTenantBrandName();
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const hideAtlasBranding = shouldHideAtlasBranding(tenant, overrides);
  const sitemapLinks = hideAtlasBranding
    ? SHARED_SITEMAP_LINKS
    : [...SHARED_SITEMAP_LINKS, ...ATLAS_CITY_LINKS];

  return (
    <div className="min-h-screen bg-bg-muted px-4 md:px-10 lg:px-20 py-24">
      <SEO
        title={`Sitemap | ${brandName}`}
        description={`Browse every page on the ${brandName} website.`}
        url="/sitemap"
      />

      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">Sitemap</h1>
          <p className="text-lg text-text-muted">Every page on the {brandName} website, in one place.</p>
        </div>

        <div className="rounded-2xl bg-bg-surface border border-border-subtle shadow-level1 p-6">
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {sitemapLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className="text-primary hover:text-primary-dark underline-offset-2 hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SitemapPage;
