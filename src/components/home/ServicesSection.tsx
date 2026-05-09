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
      description: "Retreat to tranquil spaces where comfort meets style, offering you a peaceful escape at the heart of your stay.",
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
      <section className="py-16 md:py-16 bg-bg-muted">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center flex flex-col gap-4">
            <span className="text-accent-primary font-medium tracking-wider uppercase text-sm">Elite Experiences</span>
            <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Discover Our Exclusive Services</h2>
            <div className="w-24 h-1 bg-accent-primary mx-auto rounded"></div>
            <p className="text-text-muted max-w-2xl mx-auto">{servicesSummaryCopy}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-16">
            {items.map((item, index) => (
              <div
                key={item.title}
                className={`group flex flex-col rounded-xl overflow-hidden border border-border-subtle ${
                  enableServicesAlternatingBackgrounds && index % 2 === 1 ? 'bg-bg-muted' : 'bg-bg-surface'
                }`}
              >
                {enableServicesIconography && (
                  <div className="flex items-center justify-center bg-bg-muted p-6">
                    {item.icon ? (
                      (() => {
                        const Icon = SERVICE_ICONS[item.icon as keyof typeof SERVICE_ICONS];
                        return Icon ? (
                          <Icon className="h-10 w-10 text-accent-primary" aria-hidden />
                        ) : (
                          <div className="h-12 w-12 rounded-full border border-dashed border-border-subtle" aria-hidden />
                        );
                      })()
                    ) : (
                      <div className="h-12 w-12 rounded-full border border-dashed border-border-subtle" aria-hidden />
                    )}
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-2 p-6">
                  <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                  <p className="text-text-muted mb-4 flex-1">
                    {enableServicesOneLineDescriptions && item.oneLine ? item.oneLine : item.description}
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
