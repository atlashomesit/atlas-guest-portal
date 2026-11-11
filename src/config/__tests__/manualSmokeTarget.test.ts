import { describe, expect, it } from 'vitest';
import { resolveGuestLogoUrl } from '../branding';

/**
 * MANUAL-SMOKE-1007-1
 * Point the monthly prod check at a live host site instead of Star Guest House
 */
describe('MANUAL-SMOKE-1007-1 — Smoke test target resolution', () => {
  it('resolves valid guest portal landing targets for prod smoke checks', () => {
    const logoUrl = resolveGuestLogoUrl({ slug: 'atlas' });
    expect(logoUrl).toContain('atlas-homes-logo');
  });
});
