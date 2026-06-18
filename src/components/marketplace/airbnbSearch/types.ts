export type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export type AirbnbSearchValues = {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: GuestCounts;
};

export type RecentSearch = {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};

export type DestinationOption = {
  label: string;
  region: string;
  kind: 'recent' | 'popular';
};
