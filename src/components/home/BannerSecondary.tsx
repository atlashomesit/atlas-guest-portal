import Parallax from "../commonComponents/parallax/Parallax";
import {
  enableSecondaryBannerImprovedOverlay,
  enableSecondaryBannerRemoved,
  enableSecondaryBannerValueBlock,
  secondaryBannerDefaults,
} from "../../config/homepageUxFlags";

const parallaxImage = 'https://atlashomestorage.blob.core.windows.net/listing-images/301/img_1.jpg';

const BannerSecondary = () => {
  if (enableSecondaryBannerRemoved) {
    return null;
  }

  if (enableSecondaryBannerValueBlock) {
    return (
<<<<<<< HEAD
      <div className="py-16 md:py-20">
        <div className="rounded-2xl border border-[var(--border)] bg-bg-card p-8 md:p-12 text-center shadow-level1 max-w-prose mx-auto">
          <h2 className="font-display text-xl md:text-2xl font-semibold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
            Discover the Atlas Homes difference
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] text-base md:text-lg leading-relaxed">
            Flexible stays, verified support, and curated homes — all in one place.
=======
      <div className="m-8">
        {/* Placeholder: value-block layout (2–3 proof points) pending creative */}
        <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-surface p-10 text-center shadow-level1">
          <p className="text-lg font-semibold text-text-primary">Discover the Atlas Homes difference</p>
          <p className="mt-2 text-text-muted">
            Spotlight flexible stays, verified support, and curated homes once the new creative is ready.
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
          </p>
        </div>
      </div>
    );
  }

  if (enableSecondaryBannerImprovedOverlay) {
    return (
<<<<<<< HEAD
      <div className="py-8 md:py-12">
=======
      <div className="m-8">
        {/* Placeholder: refined overlay values and CTA pending art direction */}
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
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
<<<<<<< HEAD
    <div className="py-8 md:py-12">
=======
    <div className="m-8">
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
      <Parallax
        image={parallaxImage}
        title={secondaryBannerDefaults.title}
        description={secondaryBannerDefaults.description}
      />
    </div>
  );
};

export default BannerSecondary;
