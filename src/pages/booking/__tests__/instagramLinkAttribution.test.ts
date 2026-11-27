import { describe, expect, it } from 'vitest';

function resolveAttributionChannel(search: string, isMarketplaceOrigin: boolean): 'marketplace' | 'ai_receptionist' | 'instagram_link' | null {
  if (isMarketplaceOrigin) return 'marketplace';
  const src = new URLSearchParams(search).get('src');
  if (src === 'ai_receptionist' || src === 'instagram_link') return src;
  return null;
}

describe('REV-059 instagram_link attribution', () => {
  it('captures src=instagram_link on direct booking URLs', () => {
    expect(resolveAttributionChannel('?src=instagram_link&utm_source=review_share', false)).toBe('instagram_link');
  });

  it('captures src=ai_receptionist on direct booking URLs', () => {
    expect(resolveAttributionChannel('?src=ai_receptionist', false)).toBe('ai_receptionist');
  });

  it('prioritizes marketplace origin over src query param', () => {
    expect(resolveAttributionChannel('?src=instagram_link', true)).toBe('marketplace');
  });

  it('ignores unknown src values', () => {
    expect(resolveAttributionChannel('?src=other', false)).toBeNull();
  });
});
