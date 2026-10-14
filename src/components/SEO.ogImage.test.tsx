import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import SEO, { DEFAULT_OG_IMAGE } from './SEO';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

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

describe('SEO — TASK-1039669 raster default og:image', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((m) => m.remove());
  });

  it('pins DEFAULT_OG_IMAGE to a raster .png asset (never .svg)', () => {
    expect(DEFAULT_OG_IMAGE).toBe('/og-image.png');
    expect(DEFAULT_OG_IMAGE).toMatch(/\.(png|jpe?g)$/i);
  });

  it('ships public/og-image.png as a valid 1200x630 PNG under 300 KB and references it in index.html', () => {
    const pngPath = join(repoRoot, 'public/og-image.png');
    expect(existsSync(pngPath)).toBe(true);

    const stat = statSync(pngPath);
    expect(stat.size).toBeGreaterThan(1024);
    expect(stat.size).toBeLessThan(300 * 1024);

    const buf = readFileSync(pngPath);
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A, followed by IHDR chunk with big-endian width (offset 16) and height (offset 20).
    expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(buf.toString('ascii', 12, 16)).toBe('IHDR');
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);

    const indexHtml = readFileSync(join(repoRoot, 'index.html'), 'utf8');
    expect(indexHtml).toContain('<meta property="og:image" content="/og-image.png" />');
    expect(indexHtml).toContain('<meta name="twitter:image" content="/og-image.png" />');
    expect(indexHtml).not.toContain('content="/og-image.svg"');
  });

  it('falls back to DEFAULT_OG_IMAGE (/og-image.png) when no explicit image prop is passed on marketplace hosts', () => {
    render(<SEO title="Atlastays" description="Browse homes and book direct." url="https://atlashomestays.com/" />);
    const ogImage = document.head.querySelector('meta[property="og:image"]');
    const twitterImage = document.head.querySelector('meta[name="twitter:image"]');
    expect(ogImage?.getAttribute('content')).toBe('/og-image.png');
    expect(twitterImage?.getAttribute('content')).toBe('/og-image.png');
  });
});
