import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve(__dirname, './Homepage_PropertyDetails.tsx');

describe('TASK-8216 gallery ships via /img transform, not raw blob', () => {
  it('routes gallery URLs through toTransformedGuestImageUrl', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('toTransformedGuestImageUrl');
    expect(content).toContain('buildGuestImageSrcSet');
    expect(content).toContain('GUEST_IMAGE_SRCSET_WIDTHS');
    // gallery helpers use the transform
    expect(content).toContain('getGalleryTransformedUrl');
    expect(content).toContain('getGallerySrcSet');
  });

  it('renders gallery as <img> with srcset/sizes, not CSS background-image', () => {
    const content = readFileSync(filePath, 'utf-8');
    // Find gallery mosaic block
    const galleryStart = content.indexOf('data-testid="property-photo-gallery"');
    expect(galleryStart, 'gallery mosaic not found').toBeGreaterThan(-1);
    const gallerySlice = content.slice(galleryStart, galleryStart + 6000);
    // Must contain <img> with srcSet/sizes and object-fit
    expect(gallerySlice).toContain('<img');
    expect(gallerySlice).toContain('srcSet');
    expect(gallerySlice).toContain('sizes=');
    expect(gallerySlice).toContain('objectFit');
    expect(gallerySlice).toContain('GUEST_IMAGE_SRCSET_WIDTHS');
    // Must NOT use backgroundImage for gallery photos
    expect(gallerySlice).not.toContain('backgroundImage');
    // Must contain loading eager/lazy split
    expect(gallerySlice).toContain('loading="eager"');
    expect(gallerySlice).toContain('loading="lazy"');
    expect(gallerySlice).toContain('fetchPriority="high"');
  });

  it('preserves role="img" + aria-label and Photos coming soon empty state', () => {
    const content = readFileSync(filePath, 'utf-8');
    const galleryStart = content.indexOf('data-testid="property-photo-gallery"');
    const gallerySlice = content.slice(galleryStart, galleryStart + 6000);
    expect(gallerySlice).toContain('role="img"');
    expect(gallerySlice).toContain('aria-label');
    expect(gallerySlice).toContain('Photos coming soon');
  });

  it('thumbnail alt matches aria-label pattern and hero stays eager', () => {
    const content = readFileSync(filePath, 'utf-8');
    // hero img alt contains main photo
    expect(content).toContain('— main photo');
    // thumbs alt contains photo N
    expect(content).toContain('— photo ${i + 1}');
  });
});
