import Homepage_ExclusiveService from "../homepage_components/homepage_exclusiveservice/Homepage_ExclusiveService";
import {
  enableServicesAlternatingBackgrounds,
  enableServicesConcreteCopy,
  enableServicesIconography,
  enableServicesOneLineDescriptions,
} from "../../config/homepageUxFlags";

export const SERVICES_CONTENT = {
  poeticCopy: [
    {
      title: "Sanctuary of Serenity",
      description: "Retreat to tranquil spaces where comfort meets style, offering you a peaceful escape at the heart of Atlas Homes.",
      thumbnail: "https://atlashomestorage.blob.core.windows.net/listing-images/102/img_13.jpg",
    },
    {
      title: "Tailored for Every Journey",
      description: "Find your perfect fit—our diverse accommodations are designed to suit every traveler, every story, every dream.",
      thumbnail: "https://atlashomestorage.blob.core.windows.net/listing-images/201/img_15.jpg",
    },
    {
      title: "Moments to Savor",
      description: "Delight in gourmet experiences and cozy corners, where every meal and every sip is a celebration of taste.",
      thumbnail: "https://atlashomestorage.blob.core.windows.net/listing-images/302/img_5.jpg",
    },
    {
      title: "Celebrate Life's Milestones",
      description: "Host unforgettable gatherings in elegant spaces, with every detail crafted to make your special moments shine.",
      thumbnail: "https://atlashomestorage.blob.core.windows.net/listing-images/501/IMG_2378.jpg",
    },
  ],
  concreteCopy: [
    { title: "Airport pickup", description: "TODO: Add precise copy once operations confirm coverage windows" },
    { title: "Self check-in support", description: "TODO: Add one-line support SOP for lockbox + remote KYC" },
    { title: "Long-stay discounts", description: "TODO: Add % or ₹ ranges after pricing signs off" },
    { title: "Family-friendly stays", description: "TODO: Add crib/toy/meal details for verified units" },
  ],
};

const ServicesSection = () => {
  const useExperimentalLayout =
    enableServicesConcreteCopy ||
    enableServicesIconography ||
    enableServicesOneLineDescriptions ||
    enableServicesAlternatingBackgrounds;

  if (useExperimentalLayout) {
    const items = enableServicesConcreteCopy ? SERVICES_CONTENT.concreteCopy : SERVICES_CONTENT.poeticCopy;

    return (
      <section className="py-16 md:py-4 bg-bg-muted">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center flex flex-col gap-4">
            <span className="text-accent-primary font-medium tracking-wider uppercase text-sm">Elite Experiences</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Discover Our Exclusive Services</h2>
            <div className="w-24 h-1 bg-accent-primary mx-auto rounded"></div>
            <p className="text-text-muted max-w-2xl mx-auto">
              {/* TODO: Replace with concise one-line summary per concrete service set */}
              Experience the finest in hospitality with our exclusive range of services and luxurious amenities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-16">
            {items.map((item, index) => (
              <div
                key={item.title}
                className={`group flex flex-col rounded-xl overflow-hidden shadow-level1 border border-border-subtle ${
                  enableServicesAlternatingBackgrounds && index % 2 === 1 ? 'bg-bg-muted' : 'bg-bg-surface'
                }`}
              >
                {enableServicesIconography && (
                  <div className="flex items-center justify-center bg-bg-muted p-6">
                    {/* TODO: Replace placeholder with service-specific icon */}
                    <div className="h-12 w-12 rounded-full border border-dashed border-border-subtle" aria-hidden />
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-2 p-6">
                  <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                  <p className="text-text-muted mb-4 flex-1">
                    {enableServicesOneLineDescriptions ? 'TODO: add single-sentence promise once validated' : item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return <Homepage_ExclusiveService />;
};

export default ServicesSection;
