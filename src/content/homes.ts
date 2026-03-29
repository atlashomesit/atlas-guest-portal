import { propertyData, propertyImages } from "../data";
import { filterGuestImageUrls } from "../utils/guestImageUrl";

export type Home = {
  roomNo: string;
  listingId: number;
  title: string;
  slug: string;
  href: string;
  tagline?: string;
  highlights?: string[];
  images: string[];
};

const roomNoToListingId = Object.fromEntries(
  propertyData.map((p) => [String(p.id), p.listingId]).filter(([, lid]) => lid != null)
) as Record<string, number>;

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
  const isPenthouse = roomNo === "501";
  const pathPrefix = isPenthouse ? "atlas-penthouse-501" : `atlas-homes-room-${roomNo}`;
  const listingId = roomNoToListingId[roomNo];
  if (!listingId || !Number.isFinite(listingId)) {
    throw new Error(`Missing listingId for room ${roomNo} in propertyData`);
  }
  const href = `/homes/${pathPrefix}/${listingId}`;
  const slug = `atlas-homes-room-${roomNo}`;

  return {
    roomNo,
    listingId,
    title: `Atlas ${isPenthouse ? 'Penthouse' : 'Homes'} ${roomNo}`,
    slug,
    href,
    tagline: config.tagline,
    highlights: config.highlights,
    images: filterGuestImageUrls(propertyImages[roomNo] ?? []),
  };
};

/** Same order as Our Homes: penthouse → floor 3 → 2 → 1 */
export const homes: Home[] = [
  buildHome("501", { tagline: "Penthouse retreat with rooftop deck" }),
  buildHome("301", { tagline: "Sunlit duplex with lounge seating" }),
  buildHome("302", { tagline: "Minimal, airy suite for long stays" }),
  buildHome("201", { tagline: "Family-friendly stay with study nook" }),
  buildHome("202", { tagline: "Open-plan flat with private patio" }),
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
];
