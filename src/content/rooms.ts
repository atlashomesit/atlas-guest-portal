export type Room = {
  roomNo: string;
  title: string;
  route: string;
  tagline?: string;
  highlights?: string[];
  imageSrc?: string;
};

const placeholderImage = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80";

export const defaultRoomHighlights = [
  "Premium, hotel-grade bedding",
  "Superfast Wi-Fi",
  "Fully furnished interiors",
  "In-unit workspace and smart TV",
  "Housekeeping support",
  "Prime Jubilee Hills location",
];

export const rooms: Room[] = [
  {
    roomNo: "101",
    title: "Atlas Homes 101",
    route: "/homes/101",
    tagline: "Bright 3 BHK with skyline views",
    highlights: [
      "3 spacious bedrooms",
      "Chef-ready kitchen",
      "Washer + dryer",
      "Balcony seating",
    ],
    imageSrc: placeholderImage,
  },
  {
    roomNo: "102",
    title: "Atlas Homes 102",
    route: "/homes/102",
    tagline: "Cozy corner suite for work trips",
    imageSrc: placeholderImage,
  },
  {
    roomNo: "201",
    title: "Atlas Homes 201",
    route: "/homes/201",
    tagline: "Family-friendly stay with study nook",
    imageSrc: placeholderImage,
  },
  {
    roomNo: "202",
    title: "Atlas Homes 202",
    route: "/homes/202",
    tagline: "Open-plan flat with private patio",
    imageSrc: placeholderImage,
  },
  {
    roomNo: "301",
    title: "Atlas Homes 301",
    route: "/homes/301",
    tagline: "Sunlit duplex with lounge seating",
    imageSrc: placeholderImage,
  },
  {
    roomNo: "302",
    title: "Atlas Homes 302",
    route: "/homes/302",
    tagline: "Minimal, airy suite for long stays",
    imageSrc: placeholderImage,
  },
  {
    roomNo: "501",
    title: "Atlas Homes 501",
    route: "/homes/501",
    tagline: "Penthouse retreat with rooftop deck",
    imageSrc: placeholderImage,
  },
];
