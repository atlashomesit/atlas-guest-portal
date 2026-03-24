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
      <div className="m-8">
        {/* Placeholder: value-block layout (2–3 proof points) pending creative */}
        <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-surface p-10 text-center shadow-level1">
          <p className="text-lg font-semibold text-text-primary">Discover the Atlas Homes difference</p>
          <p className="mt-2 text-text-muted">
            Spotlight flexible stays, verified support, and curated homes once the new creative is ready.
          </p>
        </div>
      </div>
    );
  }

  if (enableSecondaryBannerImprovedOverlay) {
    return (
      <div className="m-8">
        {/* Placeholder: refined overlay values and CTA pending art direction */}
        <Parallax
          image={parallaxImage}
          title={secondaryBannerDefaults.title}
          description={secondaryBannerDefaults.description}
          overlayOpacity={0.22}
        />
      </div>
    );
  }

  return (
    <div className="m-8">
      <Parallax
        image={parallaxImage}
        title={secondaryBannerDefaults.title}
        description={secondaryBannerDefaults.description}
      />
    </div>
  );
};

export default BannerSecondary;
