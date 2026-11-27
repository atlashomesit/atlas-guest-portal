import type { FlexLength } from '@/utils/flexibleSearch';

export type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export type AirbnbSearchValues = {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  flexDays?: number;
  flexLength?: FlexLength;
  flexMonths?: string[];
  nearLat?: number;
  nearLng?: number;
  nearLabel?: string;
  guests: GuestCounts;
};

export type RecentSearch = {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
};

export type DestinationOption = {
  label: string;
  region: string;
  /**
   * 'recent'   - this guest's own history (top of the dropdown).
   * 'popular'  - the bundled fallback pool.
   * 'city'     - a live city served by GET /api/public/cities (TASK-102491).
   * 'landmark' - curated Indian landmark / neighbourhood with coordinates (MKT-060).
   */
  kind: 'recent' | 'popular' | 'city' | 'landmark';
  lat?: number;
  lng?: number;
  city?: string;
};
