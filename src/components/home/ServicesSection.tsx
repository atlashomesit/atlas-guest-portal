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
import { getTenantBrandName } from "../../tenant/displayBrand";

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
  concreteCopy: servicesConcreteCopy.map((item) => ({
    ...item,
    icon: item.icon as keyof typeof SERVICE_ICONS,
  })),
};

const ServicesSection = () => {
  const brandName = getTenantBrandName();
  // TASK-4305: replace the whole "our exclusive range of services" clause so the brandified
  // copy doesn't read "<brand>'s services of services" (duplicated "services").
  const servicesSummary = servicesSummaryCopy.replace(
    "our exclusive range of services",
    `${brandName}'s curated services`,
  );
  const useExperimentalLayout =
    enableServicesConcreteCopy ||
    enableServicesIconography ||
    enableServicesOneLineDescriptions ||
    enableServicesAlternatingBackgrounds;

  if (useExperimentalLayout) {
    const items = enableServicesConcreteCopy ? SERVICES_CONTENT.concreteCopy : SERVICES_CONTENT.poeticCopy;

    return (
      <section className="py-14 md:py-16" style={{ background: "var(--bg-muted, #f5ebe0)" }}>
        <div className="container mx-auto px-4 lg:px-8 max-w-6xl">
          <div className="text-center flex flex-col gap-3 mb-2">
            <span className="text-accent-primary font-medium tracking-[0.18em] uppercase text-xs">Elite Experiences</span>
            <h2
              className="text-3xl lg:text-4xl font-semibold text-text-primary"
              style={{ fontFamily: "var(--font-family-display)" }}
            >
              Discover Our Exclusive Services
            </h2>
            <p className="text-text-muted max-w-xl mx-auto text-sm md:text-base leading-relaxed">{servicesSummary}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 py-10 md:py-12 items-stretch">
            {items.map((item, index) => {
              const pastel =
                index % 2 === 0
                  ? "linear-gradient(160deg, #ffe4d6 0%, #f08c71 100%)"
                  : "linear-gradient(160deg, #f0eafd 0%, #c5b4f3 100%)";
              return (
              <div
                key={item.title}
                className={`group flex h-full flex-col rounded-2xl overflow-hidden border border-border-subtle bg-bg-surface shadow-sm ${
                  enableServicesAlternatingBackgrounds && index % 2 === 1 ? "bg-bg-muted" : ""
                }`}
              >
                {enableServicesIconography && (
                  <div
                    className="flex items-center justify-center min-h-[120px] relative overflow-hidden"
                    style={{ background: pastel }}
                    aria-hidden
                  >
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage:
                          "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
                        backgroundSize: "28px 28px",
                      }}
                    />
                    {item.icon ? (
                      (() => {
                        const Icon = SERVICE_ICONS[item.icon as keyof typeof SERVICE_ICONS];
                        return Icon ? (
                          <Icon className="relative h-10 w-10 text-white drop-shadow-sm" aria-hidden />
                        ) : (
                          <div className="h-12 w-12 rounded-full border border-dashed border-white/50" aria-hidden />
                        );
                      })()
                    ) : (
                      <div className="h-12 w-12 rounded-full border border-dashed border-white/50" aria-hidden />
                    )}
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-2 p-5 md:p-6 min-h-[140px]">
                  <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed flex-1">
                    {enableServicesOneLineDescriptions && item.oneLine ? item.oneLine : item.description}
                  </p>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return <Homepage_ExclusiveService />;
};

export default ServicesSection;
