import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import SEO from './SEO';

/**
 * TASK-102421 — sharing a tenant direct-booking link (WhatsApp/iMessage/Facebook)
 * must render a rich preview card with the property hero photo, not a blank card.
 *
 * Source verification 2026-09-23: every listing surface already passes its hero photo
 * as `image` (Homepage_PropertyDetails + heritage PropertyDetails pass `primaryImage`;
 * Home passes per-tenant `primaryOgImage`). This test pins the SEO contract: an
 * explicit per-listing image always lands on og:image + twitter:image with a large
 * summary card, so unfurls have a photo.
 */
describe('SEO — TASK-102421 per-listing og:image preview', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((m) => m.remove());
  });

  it('writes the listing hero photo to og:image and twitter:image with a large card', () => {
    const hero = 'https://example.com/photos/royal-palms-hero.jpg';
    render(<SEO title="Royal Palms | Villa Shanti" description="Book direct." image={hero} url="https://stays.villashanti.com/" />);
    const ogImage = document.head.querySelector('meta[property="og:image"]');
    const twitterImage = document.head.querySelector('meta[name="twitter:image"]');
    const twitterCard = document.head.querySelector('meta[name="twitter:card"]');
    expect(ogImage?.getAttribute('content')).toBe(hero);
    expect(twitterImage?.getAttribute('content')).toBe(hero);
    expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');
  });
});
