import { describe, expect, it } from 'vitest';
import { apexRedirectForHost } from './atlasHostCanonical';

describe('apexRedirectForHost (TASK-102420)', () => {
  it('301s www.atlashomestays.com to the apex, preserving path+query and forcing https', () => {
    expect(apexRedirectForHost('http://www.atlashomestays.com/homes/x/y?foo=1')).toBe(
      'https://atlashomestays.com/homes/x/y?foo=1',
    );
  });

  it('leaves the apex, pages.dev origins, tenants, and atlashomes.in alone', () => {
    expect(apexRedirectForHost('https://atlashomestays.com/')).toBeNull();
    expect(apexRedirectForHost('https://atlas-guest-portal.pages.dev/')).toBeNull();
    expect(apexRedirectForHost('https://starguesthouse.atlastays.com/homes/a/b')).toBeNull();
    // different brand — founder call, not a www-prefix cleanup
    expect(apexRedirectForHost('https://atlashomes.in/')).toBeNull();
    expect(apexRedirectForHost('https://www.atlashomes.in/')).toBeNull();
    expect(apexRedirectForHost('not a url')).toBeNull();
  });
});
