import Parallax from "../commonComponents/parallax/Parallax";
import {
  enableSecondaryBannerImprovedOverlay,
  enableSecondaryBannerRemoved,
  enableSecondaryBannerValueBlock,
  secondaryBannerDefaults,
} from "../../config/homepageUxFlags";

const parallaxImage = "";

const BannerSecondary = () => {
  if (enableSecondaryBannerRemoved) {
    return null;
  }

  if (enableSecondaryBannerValueBlock) {
    return (
      <div className="py-16 md:py-20">
        <div className="rounded-2xl border border-[var(--border)] bg-bg-card p-8 md:p-12 text-center shadow-level1 max-w-prose mx-auto">
          <h2 className="font-display text-xl md:text-2xl font-semibold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
            Discover the Atlas Homes difference
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] text-base md:text-lg leading-relaxed">
            Flexible stays, verified support, and curated homes — all in one place.          </p>
        </div>
      </div>
    );
  }

  if (enableSecondaryBannerImprovedOverlay) {
    return (
      <div className="py-8 md:py-12">        <Parallax
          image={parallaxImage}
          title={secondaryBannerDefaults.title}
          description={secondaryBannerDefaults.description}
          overlayOpacity={0.22}
        />
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12">      <Parallax
        image={parallaxImage}
        title={secondaryBannerDefaults.title}
        description={secondaryBannerDefaults.description}
      />
    </div>
  );
};

export default BannerSecondary;
