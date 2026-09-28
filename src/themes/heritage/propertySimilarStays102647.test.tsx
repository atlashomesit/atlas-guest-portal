import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve(__dirname, './PropertyDetails.tsx');

describe('TASK-102647 heritage theme "Similar stays" cards ship via /img transform, not a raw blob URL', () => {
  it('sanitizes and transforms the similar-listing cover photo before rendering it', () => {
    const content = readFileSync(filePath, 'utf-8');
    const sectionStart = content.indexOf('aria-label="Similar stays"');
    expect(sectionStart, 'Similar stays section not found').toBeGreaterThan(-1);
    const section = content.slice(sectionStart, sectionStart + 4000);

    // Same bug/fix as the default theme (Homepage_PropertyDetails.tsx, TASK-102647): the
    // heritage theme has its own independent copy of this "Similar stays" block, and it must
    // sanitize (allowlist) AND transform (/img proxy) the cover photo, not render it raw.
    expect(section).toContain('sanitizeGuestImageUrl(');
    expect(section).toContain('toTransformedGuestImageUrl(');
    expect(section).toContain('buildGuestImageSrcSet(');
    expect(section).toContain('GUEST_IMAGE_SRCSET_WIDTHS');

    expect(section).not.toMatch(/const img = \(it\.coverPhotoUrl/);
    expect(section).toContain('srcSet={imgSrcSet}');
  });

  it('still skips rendering the photo (not the whole card) when a similar listing has none', () => {
    const content = readFileSync(filePath, 'utf-8');
    const sectionStart = content.indexOf('aria-label="Similar stays"');
    const section = content.slice(sectionStart, sectionStart + 4000);
    expect(section).toContain('{img && (');
  });
});
