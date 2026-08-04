// Homepage UX experiment flags for sections 5–8. All flags default to false
// to preserve current visuals.
export const enableSecondaryBannerRemoved = false;
export const enableSecondaryBannerValueBlock = false;
export const enableSecondaryBannerImprovedOverlay = false;

export const enableServicesConcreteCopy = true;
/** Lucide icons from `servicesConcreteCopy` — keep true with concrete copy so cards are not empty shells. */
export const enableServicesIconography = true;
export const enableServicesOneLineDescriptions = false;
export const enableServicesAlternatingBackgrounds = false;

export const enableWhyChooseConciseBullets = false;
export const enableWhyChooseStatsBadges = false;
export const enableWhyChooseNoSelectionState = false;
export const enableWhyChooseAccordion = false;

export const enableTestimonialsStatic3 = false;
export const enableTestimonialsSingleCentered = false;

export const enableFooterMiniCtaAboveFooter = false;

// Production-safe defaults for experimental variants. These keep copy and
// icon selections centralized so that enabling a variant never shows placeholder text
// placeholders.
export const secondaryBannerDefaults = {
  title: "Where Every Stay Feels Like Home",
  description:
    "Every detail is designed for your comfort. Relax in beautifully appointed spaces, enjoy modern amenities, and make every moment unforgettable.",
};

export const servicesSummaryCopy =
  "Experience the finest in hospitality with our exclusive range of services and luxurious amenities.";

export const servicesConcreteCopy = [
  {
    title: "Airport pickup",
    description: "Pre-booked rides with vetted drivers who track your arrival and help with luggage.",
    icon: "plane",
    oneLine: "Vetted drivers ready when your flight lands.",
  },
  {
    title: "Self check-in support",
    description: "Guided lockbox and KYC steps with on-call help to get you settled quickly.",
    icon: "key",
    oneLine: "Clear lockbox steps with instant help if needed.",
  },
  {
    title: "Long-stay discounts",
    description: "Tiered savings for weekly and monthly stays so you can plan with confidence.",
    icon: "percent",
    oneLine: "Save more on weekly and monthly bookings.",
  },
  {
    title: "Family-friendly stays",
    description: "Spacious homes with extra bedding options and layouts suited for groups.",
    icon: "users",
    oneLine: "Room to spread out for families and groups.",
  },
];

export const whyChooseHighlights = [
  {
    title: "Comfort Redefined",
    description: "Thoughtfully designed stays that balance cozy textures with modern finishes.",
  },
  {
    title: "Unmatched Hospitality",
    description: "Responsive hosts who handle airport pickups, late check-ins, and local tips.",
  },
  {
    title: "Prime Locations",
    description: "Homes in well-connected neighbourhoods with easy access to work and leisure hubs.",
  },
  {
    title: "Value for Money",
    description: "Premium stays at competitive rates with transparent pricing and offers.",
  },
  {
    title: "Memorable Experiences",
    description: "Curated recommendations that make work trips, family visits, and staycations feel effortless.",
  },
];

export const whyChooseStatsBadges = [
  "4.8+ avg rating",
  "Well-connected locations",
  "Fast support on WhatsApp",
];

export const testimonialsCopy = {
  headline: "What guests are saying",
  supporting: "Recent guests call out spotless homes, attentive hosts, and smooth check-ins.",
  spotlightHeadline: "Guest spotlight",
  spotlightSupporting: "Highlights from recent stays across our properties.",
};

export const footerMiniCtaCopy = {
  headline: "Need help choosing a room? WhatsApp us",
  buttonLabel: "Chat with our team",
};
