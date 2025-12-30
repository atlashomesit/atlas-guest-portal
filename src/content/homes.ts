import { propertyImages } from "../data";

export type Home = {
  roomNo: string;
  title: string;
  slug: string;
  href: string;
  tagline?: string;
  highlights?: string[];
  images: string[];
};

const placeholderImage = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80";

export const defaultHomeHighlights = [
  "Premium, hotel-grade bedding",
  "Superfast Wi-Fi",
  "Fully furnished interiors",
  "In-unit workspace and smart TV",
  "Housekeeping support",
  "Prime Jubilee Hills location",
];

type HomeConfig = Pick<Home, "tagline" | "highlights">;

const buildHome = (roomNo: string, config: HomeConfig = {}): Home => {
  const isPenthouse = roomNo === '501';
  const pathPrefix = isPenthouse ? 'atlas-penthouse-501' : `atlas-homes-room-${roomNo}`;
  const href = `/homes/${pathPrefix}/${roomNo}`;
  const slug = `atlas-homes-room-${roomNo}`;

  return {
    roomNo,
    title: `Atlas ${isPenthouse ? 'Penthouse' : 'Homes'} ${roomNo}`,
    slug,
    href,
    tagline: config.tagline,
    highlights: config.highlights,
    images: propertyImages[roomNo] ?? [placeholderImage],
  };
};

export const homes: Home[] = [
  buildHome("101", {
    tagline: "Bright 3 BHK with skyline views",
    highlights: [
      "3 spacious bedrooms",
      "Chef-ready kitchen",
      "Washer + dryer",
      "Balcony seating",
    ],
  }),
  buildHome("102", { tagline: "Cozy corner suite for work trips" }),
  buildHome("201", { tagline: "Family-friendly stay with study nook" }),
  buildHome("202", { tagline: "Open-plan flat with private patio" }),
  buildHome("301", { tagline: "Sunlit duplex with lounge seating" }),
  buildHome("302", { tagline: "Minimal, airy suite for long stays" }),
  buildHome("501", { tagline: "Penthouse retreat with rooftop deck" }),
];
