/**
 * REV-070: Weighted / rotating multi-site review solicitation picker
 * across up to 3 chosen public review sites (Google, TripAdvisor, Booking/Airbnb).
 */

export interface PublicReviewSiteTarget {
  site: 'Google' | 'TripAdvisor' | 'Booking' | 'Airbnb';
  url: string;
  weight: number; // positive weight, e.g. 50, 30, 20
}

export function pickWeightedReviewSite(
  targets: PublicReviewSiteTarget[],
  seedKey: string
): PublicReviewSiteTarget | null {
  const valid = targets
    .filter((t) => t.url.trim().length > 0 && t.weight > 0)
    .slice(0, 3);
  if (!valid.length) return null;

  const totalWeight = valid.reduce((sum, t) => sum + t.weight, 0);
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  let cursor = hash % totalWeight;
  for (const t of valid) {
    if (cursor < t.weight) return t;
    cursor -= t.weight;
  }
  return valid[0];
}
