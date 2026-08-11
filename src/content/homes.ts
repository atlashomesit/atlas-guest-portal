import { resolveStaticMaxGuests } from "../api/listingClient";
import { propertyData } from "../data";
import { filterGuestImageUrls } from "../utils/guestImageUrl";
import { getTenantContext } from "../tenant/tenantContext";
import { getTenantOverrides } from "../tenant/tenantOverrides";

export type Home = {
  roomNo: string;
  listingId: number;
  title: string;
  slug: string;
  href: string;
  maxGuests: number;
  tagline?: string;
  highlights?: string[];
  images: string[];
};

const roomNoToListingId = Object.fromEntries(
  propertyData.map((p) => [String(p.id), p.listingId]).filter(([, lid]) => lid != null)
) as Record<string, number>;

const roomNoToPropertyRow = Object.fromEntries(propertyData.map((p) => [String(p.id), p])) as Record<
  string,
  (typeof propertyData)[number]
>;

export const defaultHomeHighlights = [
  "Premium, hotel-grade bedding",
  "Superfast Wi-Fi",
  "Fully furnished interiors",
  "In-unit workspace and smart TV",
  "Housekeeping support",
  "Prime neighbourhood location",
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
  const row = roomNoToPropertyRow[roomNo];
  const maxGuests = resolveStaticMaxGuests((row ?? {}) as Record<string, unknown>) ?? 2;

  return {
    roomNo,
    listingId,
    title: `${isPenthouse ? 'Penthouse' : 'Suite'} ${roomNo}`,
    slug,
    href,
    maxGuests,
    tagline: config.tagline,
    highlights: config.highlights,
    images: filterGuestImageUrls(row?.property_img ?? []),
  };
};

/** Same order as Our Homes: penthouse → floor 3 → 2 → 1 */
const allHomes: Home[] = [
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

export function getTenantFilteredHomes(): Home[] {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  if (overrides.onlyApiListings) {
    return [];
  }
  const tenantAllowedIds = new Set((overrides.homes ?? []).map((h) => String(h.roomNo)));

  if (tenantAllowedIds.size === 0) {
    return allHomes;
  }

  return allHomes.filter((h) => tenantAllowedIds.has(h.roomNo));
}

export const homes: Home[] = allHomes;
