import Parallax from "../commonComponents/parallax/Parallax";
import {
  enableSecondaryBannerImprovedOverlay,
  enableSecondaryBannerRemoved,
  enableSecondaryBannerValueBlock,
  secondaryBannerDefaults,
} from "../../config/homepageUxFlags";
import { getTenantContext } from "../../tenant/tenantContext";

const parallaxImage = "";

const BannerSecondary = () => {
  const tenant = getTenantContext();
  const brandName = tenant?.name ?? "Atlas Homes";

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
  const title = secondaryBannerDefaults.title.replace(/Atlas Homes/g, brandName);
  const description = secondaryBannerDefaults.description.replace(/Atlas Homes/g, brandName);

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
