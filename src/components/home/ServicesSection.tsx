import Homepage_ExclusiveService from "../homepage_components/homepage_exclusiveservice/Homepage_ExclusiveService";
import {
  enableServicesAlternatingBackgrounds,
  enableServicesConcreteCopy,
  enableServicesIconography,
  enableServicesOneLineDescriptions,
  servicesConcreteCopy,
  servicesSummaryCopy,
} from "../../config/homepageUxFlags";
import { KeyRound, PercentCircle, Plane, UsersRound } from "lucide-react";

const SERVICE_ICONS = {
  plane: Plane,
  key: KeyRound,
  percent: PercentCircle,
  users: UsersRound,
} as const;

type ServiceItem = {
  title: string;
  description: string;
  thumbnail?: string;
  icon?: keyof typeof SERVICE_ICONS;
  oneLine?: string;
};

// eslint-disable-next-line react-refresh/only-export-components -- content config, co-located with ServicesSection
export const SERVICES_CONTENT: {
  poeticCopy: ServiceItem[];
  concreteCopy: ServiceItem[];
} = {
  poeticCopy: [
    {
      title: "Sanctuary of Serenity",
      description: "Retreat to tranquil spaces where comfort meets style, offering you a peaceful escape at the heart of Atlas Homes.",
      thumbnail: "",
    },
    {
      title: "Tailored for Every Journey",
      description: "Find your perfect fit—our diverse accommodations are designed to suit every traveler, every story, every dream.",
      thumbnail: "",
    },
    {
      title: "Moments to Savor",
      description: "Delight in gourmet experiences and cozy corners, where every meal and every sip is a celebration of taste.",
      thumbnail: "",
    },
    {
      title: "Celebrate Life's Milestones",
      description: "Host unforgettable gatherings in elegant spaces, with every detail crafted to make your special moments shine.",
      thumbnail: "",
    },
  ],
  concreteCopy: servicesConcreteCopy,
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
      <section
        className="py-section-gap md:py-section-gap-md lg:py-section-gap-lg"
        style={{ background: 'linear-gradient(180deg, var(--secondary-gradient-start) 0%, var(--secondary-gradient-end) 100%)' }}
      >
        <div className="mx-auto max-w-luxury px-[5%]">
          <div className="text-center max-w-prose mx-auto mb-12 md:mb-16">
            <p className="text-[var(--section-heading-muted)] font-semibold tracking-[0.08em] uppercase text-xs md:text-sm mb-2">
              What we offer
            </p>
            <h2 className="font-display text-[var(--text-h2)] font-semibold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
              Premium Amenities
            </h2>
            <p className="mt-4 text-[var(--text-muted)] text-base md:text-lg leading-relaxed">
              Every detail designed to ensure your comfort and convenience during your stay.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {items.map((item) => (
              <div
                key={item.title}
                className="group flex flex-col items-center text-center rounded-2xl border border-white/80 bg-white/90 backdrop-blur-sm p-8 shadow-[var(--shadow-level-2)] transition-all duration-[180ms] hover:shadow-[var(--shadow-level-3)] hover:-translate-y-1.5 hover:scale-[1.02]"
              >
                {enableServicesIconography && (
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/90 text-[var(--amenity-icon)] mb-4 shadow-[var(--shadow-level-1)]" aria-hidden>
                    {item.icon ? (
                      (() => {
                        const Icon = SERVICE_ICONS[item.icon as keyof typeof SERVICE_ICONS];
                        return Icon ? <Icon className="h-8 w-8" aria-hidden /> : null;
                      })()
                    ) : null}
                  </div>
                )}
                <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-family-display)' }}>{item.title}</h3>
                <p className="mt-3 text-[var(--text-secondary)] text-[15px] md:text-base leading-relaxed flex-1">
                  {enableServicesOneLineDescriptions && item.oneLine ? item.oneLine : item.description}
                </p>              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return <Homepage_ExclusiveService />;
};

export default ServicesSection;
