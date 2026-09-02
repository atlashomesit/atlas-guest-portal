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

  it('labels the gallery region and gives the empty placeholder an img role + name', () => {
    const content = readFileSync(filePath, 'utf-8');
    // Anchor at the ELEMENT start, not the data-testid: role and aria-label are authored before
    // data-testid on the same tag, so a testid-anchored slice cuts them off.
    const galleryStart = content.lastIndexOf('<div', content.indexOf('data-testid="property-photo-gallery"'));
    const gallerySlice = content.slice(galleryStart, galleryStart + 6000);

    // The container is a NAMED LANDMARK. It is deliberately not role="img": it holds several
    // photos, and each rendered photo is a real <img alt=...> that carries the img role natively.
    expect(gallerySlice).toContain('role="region"');
    expect(gallerySlice).toContain('aria-label="Property photos"');

    // role="img" survives exactly where it is still needed -- the EMPTY placeholder, which has no
    // <img> to carry it. Both role and name are conditional on there being no photo, so assert the
    // condition rather than the old unconditional literal: TASK-8061 wrapped photos in Fancybox
    // anchors, and the previous `toContain('role="img"')` went red on that formatting change alone
    // while the accessibility contract was intact and had in fact improved.
    expect(gallerySlice).toMatch(/role=\{galleryUrls\[0\] \? undefined : 'img'\}/);
    expect(gallerySlice).toMatch(/aria-label=\{galleryUrls\[0\] \? undefined :/);
    expect(gallerySlice).toContain('photo coming soon');
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
