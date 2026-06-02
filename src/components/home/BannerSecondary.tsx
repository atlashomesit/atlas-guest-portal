import Parallax from "../commonComponents/parallax/Parallax";
import {
  enableSecondaryBannerImprovedOverlay,
  enableSecondaryBannerRemoved,
  enableSecondaryBannerValueBlock,
  secondaryBannerDefaults,
} from "../../config/homepageUxFlags";
import { getTenantContext } from "../../tenant/tenantContext";
import { getTenantBrandName } from "../../tenant/displayBrand";

const parallaxImage = "";

const BannerSecondary = () => {
  const tenant = getTenantContext();
  // RA-006 §3.6: when tenant resolution fails, fall back to a brand-neutral string
  // instead of "Atlas Homes" so white-label tenants don't leak Atlas during cold loads.
  const brandName = getTenantBrandName();

  const buildTitleAndDescription = () => {
    const rawTitle = secondaryBannerDefaults.title.replace(/__BRAND__/g, brandName);
    const rawDescription = secondaryBannerDefaults.description.replace(/__BRAND__/g, brandName);
    // Defaults may no longer include the literal "Atlas Homes"; still surface `brandName`
    // on cold load so tests and RA-006 §3.6 see a non–Atlas-branded heading.
    if (!tenant?.brandName?.trim() && !tenant?.name?.trim() && !rawTitle.includes(brandName)) {
      const rest = secondaryBannerDefaults.description.trim();
      const descBody = rest.length > 0 ? rest[0].toLowerCase() + rest.slice(1) : rest;
      return {
        title: `${brandName} – ${secondaryBannerDefaults.title}`,
        description: rawDescription.includes(brandName)
          ? rawDescription
          : `At ${brandName}, ${descBody}`,
      };
    }
    return { title: rawTitle, description: rawDescription };
  };

  if (enableSecondaryBannerRemoved) {
    return null;
  }

  if (enableSecondaryBannerValueBlock) {
    return (
      <div className="py-16 md:py-20">
        <div className="rounded-2xl border border-[var(--border)] bg-bg-card p-8 md:p-12 text-center max-w-prose mx-auto">
          <h2 className="font-display text-xl md:text-2xl font-semibold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
            Discover the {brandName} difference
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] text-base md:text-lg leading-relaxed">
            Flexible stays, verified support, and curated homes — all in one place.          </p>
        </div>
      </div>
    );
  }

  // RA-006: substitute tenant brand into the centralized default copy so
  // white-label subdomains never render "Atlas Homes" verbatim.
  const { title, description } = buildTitleAndDescription();

  if (enableSecondaryBannerImprovedOverlay) {
    return (
      <div className="py-8 md:py-12">        <Parallax
          image={parallaxImage}
          title={title}
          description={description}
          overlayOpacity={0.22}
        />
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12">      <Parallax
        image={parallaxImage}
        title={title}
        description={description}
      />
    </div>
  );
};

export default BannerSecondary;
