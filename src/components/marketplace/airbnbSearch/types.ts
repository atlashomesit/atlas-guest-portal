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
  /**
   * 'recent' - this guest's own history (top of the dropdown).
   * 'popular' - the bundled fallback pool (Bali/Dubai/Paris included).
   * 'city'    - a live city served by GET /api/public/cities (TASK-102491).
   */
  kind: 'recent' | 'popular' | 'city';
};
