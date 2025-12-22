import Parallax from "../commonComponents/parallax/Parallax";
import {
  enableSecondaryBannerImprovedOverlay,
  enableSecondaryBannerRemoved,
  enableSecondaryBannerValueBlock,
} from "../../config/homepageUxFlags";

const parallaxImage = 'https://atlashomestorage.blob.core.windows.net/listing-images/301/img_1.jpg';

const BannerSecondary = () => {
  if (enableSecondaryBannerRemoved) {
    return null;
  }

  if (enableSecondaryBannerValueBlock) {
    return (
      <div className="m-8">
        {/* TODO: Replace with value-block layout that highlights 2–3 proof points side-by-side */}
        <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-surface p-10 text-center shadow-level1">
          <p className="text-lg font-semibold text-text-primary">Secondary banner value-block variant placeholder</p>
          <p className="mt-2 text-text-muted">Showcase concise reasons to book Atlas Homes once content is approved.</p>
        </div>
      </div>
    );
  }

  if (enableSecondaryBannerImprovedOverlay) {
    return (
      <div className="m-8">
        {/* TODO: Swap in refined overlay values and CTA once new art direction is finalized */}
        <Parallax
          image={parallaxImage}
          title={'Atlas Homes – Where Every Stay Feels Like Home'}
          description={'At Atlas Homes, every detail is designed for your comfort. Relax in beautifully appointed spaces, enjoy modern amenities, and make every moment unforgettable.'}
          overlayOpacity={0.22}
        />
      </div>
    );
  }

  return (
    <div className="m-8">
      <Parallax
        image={parallaxImage}
        title={'Atlas Homes – Where Every Stay Feels Like Home'}
        description={'At Atlas Homes, every detail is designed for your comfort. Relax in beautifully appointed spaces, enjoy modern amenities, and make every moment unforgettable.'}
      />
    </div>
  );
};

export default BannerSecondary;
