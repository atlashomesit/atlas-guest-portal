import { describe, it, expect } from 'vitest';
import { pickWeightedReviewSite } from './reviewSiteRotation';

describe('REV-070 pickWeightedReviewSite', () => {
  it('deterministically picks among up to 3 weighted public review sites', () => {
    const targets = [
      { site: 'Google' as const, url: 'https://g.page/r/test/review', weight: 60 },
      { site: 'TripAdvisor' as const, url: 'https://tripadvisor.com/test', weight: 40 },
    ];
    const picked = pickWeightedReviewSite(targets, 'BOOK-1001');
    expect(picked).not.toBeNull();
    expect(['Google', 'TripAdvisor']).toContain(picked?.site);
    expect(pickWeightedReviewSite(targets, 'BOOK-1001')).toEqual(picked);
  });

  it('returns null when no valid weighted targets are configured', () => {
    expect(pickWeightedReviewSite([], 'BOOK-1001')).toBeNull();
  });
});
