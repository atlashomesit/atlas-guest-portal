import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve(__dirname, './Homepage_PropertyDetails.tsx');

describe('TASK-102647 "Similar stays" cards ship via /img transform, not a raw blob URL', () => {
  it('sanitizes and transforms the similar-listing cover photo before rendering it', () => {
    const content = readFileSync(filePath, 'utf-8');
    const sectionStart = content.indexOf('aria-label="Similar stays"');
    expect(sectionStart, 'Similar stays section not found').toBeGreaterThan(-1);
    const section = content.slice(sectionStart, sectionStart + 4000);

    // it.coverPhotoUrl / photoUrls[0] comes straight from the /similar API response and is
    // NOT pre-filtered the way the gallery's property_img is (filterGuestImageUrls runs
    // before buildAtlasMediaUrl there). Must sanitize (allowlist) AND transform (/img proxy)
    // here, not just re-render the raw field.
    expect(section).toContain('sanitizeGuestImageUrl(');
    expect(section).toContain('toTransformedGuestImageUrl(');
    expect(section).toContain('buildGuestImageSrcSet(');
    expect(section).toContain('GUEST_IMAGE_SRCSET_WIDTHS');

    // Must NOT assign the <img> src straight from the raw API field any more (the TASK-102647
    // bug: a bare `atlashomestorage.blob.core.windows.net` URL used directly as src).
    expect(section).not.toMatch(/const img = \(it\.coverPhotoUrl/);

    // The rendered <img> must carry a srcset now, not just a bare full-resolution src.
    expect(section).toContain('srcSet={imgSrcSet}');
  });

  it('still skips rendering the photo (not the whole card) when a similar listing has none', () => {
    const content = readFileSync(filePath, 'utf-8');
    const sectionStart = content.indexOf('aria-label="Similar stays"');
    const section = content.slice(sectionStart, sectionStart + 4000);
    expect(section).toContain('{img && (');
  });
});
