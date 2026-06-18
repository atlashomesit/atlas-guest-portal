import type { AirbnbSearchValues, RecentSearch } from './types';

const STORAGE_KEY = 'atlas_marketplace_recent_searches_v1';
const MAX_RECENT = 5;

export function readRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSearch[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function persistRecentSearch(values: AirbnbSearchValues): void {
  if (typeof window === 'undefined' || !values.destination.trim()) return;
  const totalGuests = values.guests.adults + values.guests.children;
  const entry: RecentSearch = {
    destination: values.destination.trim(),
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    guests: totalGuests,
  };
  const deduped = [
    entry,
    ...readRecentSearches().filter(
      (r) => r.destination.toLowerCase() !== entry.destination.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
