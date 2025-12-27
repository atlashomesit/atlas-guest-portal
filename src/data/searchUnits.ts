export type SearchUnit = {
  id: string;
  title: string;
  location: string;
  pricePerNight: number;
  maxGuests: number;
  availableFrom: string;
  availableTo: string;
  imageUrl: string;
};

export const SEARCH_UNITS: SearchUnit[] = [
  {
    id: "skyline-suite",
    title: "Skyline Suite",
    location: "Gachibowli",
    pricePerNight: 5200,
    maxGuests: 4,
    availableFrom: "2025-01-01",
    availableTo: "2025-12-31",
    imageUrl: "/hero_images/slider_bg.png",
  },
  {
    id: "business-loft",
    title: "Business Loft",
    location: "Hitech City",
    pricePerNight: 4600,
    maxGuests: 3,
    availableFrom: "2025-03-01",
    availableTo: "2025-09-30",
    imageUrl: "/gallery/8.png",
  },
  {
    id: "garden-residence",
    title: "Garden Residence",
    location: "Kondapur",
    pricePerNight: 6100,
    maxGuests: 6,
    availableFrom: "2025-02-15",
    availableTo: "2025-11-15",
    imageUrl: "/gallery/7.png",
  },
  {
    id: "metro-studio",
    title: "Metro Studio",
    location: "Madhapur",
    pricePerNight: 3500,
    maxGuests: 2,
    availableFrom: "2025-01-15",
    availableTo: "2025-04-30",
    imageUrl: "/gallery/6.png",
  },
];
