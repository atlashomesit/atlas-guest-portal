import { describe, it, expect } from 'vitest';
import { isSitemapEligibleListing } from './sitemap.xml';

/**
 * TASK-102424 — sitemap.xml must contain only published, active, public-facing
 * listings. The generator previously emitted every /listings/public row with a
 * numeric id, so deleted/unpublished drafts leaked in as 404 crawl errors.
 */
describe('isSitemapEligibleListing — TASK-102424 published-only sitemap', () => {
  it('keeps normal published rows (no status fields)', () => {
    expect(isSitemapEligibleListing({ id: 180, propertyName: 'Stay by City Focus' })).toBe(true);
    expect(isSitemapEligibleListing({ id: 1, tenantSlug: 'atlas', title: 'Villa', status: 'published' })).toBe(true);
    expect(isSitemapEligibleListing({ id: 1, isPublished: true, isActive: true })).toBe(true);
  });

  it('drops explicit unpublished / inactive / deleted flags', () => {
    expect(isSitemapEligibleListing({ id: 2, isPublished: false })).toBe(false);
    expect(isSitemapEligibleListing({ id: 3, isActive: false })).toBe(false);
    expect(isSitemapEligibleListing({ id: 4, isDeleted: true })).toBe(false);
  });

  it('drops draft-like status strings case-insensitively', () => {
    for (const status of ['draft', 'Draft', 'UNPUBLISHED', 'inactive', 'deleted', 'archived']) {
      expect(isSitemapEligibleListing({ id: 5, status })).toBe(false);
    }
  });
});
