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

export const homes: Home[] = [
  {
    roomNo: "101",
    title: "Atlas Homes 101",
    slug: "atlas-homes-room-101",
    href: "/property_details/atlas-homes-room-101",
    tagline: "Bright 3 BHK with skyline views",
    highlights: [
      "3 spacious bedrooms",
      "Chef-ready kitchen",
      "Washer + dryer",
      "Balcony seating",
    ],
    images: propertyImages["101"] ?? [placeholderImage],
  },
  {
    roomNo: "102",
    title: "Atlas Homes 102",
    slug: "atlas-homes-room-102",
    href: "/property_details/atlas-homes-room-102",
    tagline: "Cozy corner suite for work trips",
    images: propertyImages["102"] ?? [placeholderImage],
  },
  {
    roomNo: "201",
    title: "Atlas Homes 201",
    slug: "atlas-homes-room-201",
    href: "/property_details/atlas-homes-room-201",
    tagline: "Family-friendly stay with study nook",
    images: propertyImages["201"] ?? [placeholderImage],
  },
  {
    roomNo: "202",
    title: "Atlas Homes 202",
    slug: "atlas-homes-room-202",
    href: "/property_details/atlas-homes-room-202",
    tagline: "Open-plan flat with private patio",
    images: propertyImages["202"] ?? [placeholderImage],
  },
  {
    roomNo: "301",
    title: "Atlas Homes 301",
    slug: "atlas-homes-room-301",
    href: "/property_details/atlas-homes-room-301",
    tagline: "Sunlit duplex with lounge seating",
    images: propertyImages["301"] ?? [placeholderImage],
  },
  {
    roomNo: "302",
    title: "Atlas Homes 302",
    slug: "atlas-homes-room-302",
    href: "/property_details/atlas-homes-room-302",
    tagline: "Minimal, airy suite for long stays",
    images: propertyImages["302"] ?? [placeholderImage],
  },
  {
    roomNo: "501",
    title: "Atlas Homes 501",
    slug: "atlas-homes-room-501",
    href: "/property_details/atlas-homes-room-501",
    tagline: "Penthouse retreat with rooftop deck",
    images: propertyImages["501"] ?? [placeholderImage],
  },
];
