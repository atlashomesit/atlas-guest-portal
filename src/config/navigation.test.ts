import { describe, expect, it } from 'vitest';
import {
  helpNav,
  primaryNav,
  footerLegalNav,
  menuNav,
  resolveNavTo,
} from './navigation';

describe('TASK-10299142: navigation items have valid hrefs pointing to /terms, /privacy, and /contact', () => {
  it('helpNav contains terms, privacy, and contact with matching href and to', () => {
    const terms = helpNav.find((item) => item.label.toLowerCase() === 'terms');
    expect(terms).toBeDefined();
    expect(terms?.href).toBe('/terms');
    expect(terms?.to).toBe('/terms');

    const privacy = helpNav.find((item) => item.label.toLowerCase() === 'privacy');
    expect(privacy).toBeDefined();
    expect(privacy?.href).toBe('/privacy');
    expect(privacy?.to).toBe('/privacy');

    const contact = helpNav.find((item) => item.label.toLowerCase() === 'contact');
    expect(contact).toBeDefined();
    expect(contact?.href).toBe('/contact');
    expect(contact?.to).toBe('/contact');
  });

  it('primaryNav Help item points to /contact', () => {
    const help = primaryNav.find((item) => item.label.toLowerCase() === 'help');
    expect(help).toBeDefined();
    expect(help?.href).toBe('/contact');
    expect(help?.to).toBe('/contact');
  });

  it('footerLegalNav points to /terms, /privacy, and /contact', () => {
    expect(footerLegalNav).toHaveLength(3);
    expect(footerLegalNav.map((i) => i.href)).toEqual(['/terms', '/privacy', '/contact']);
    expect(footerLegalNav.map((i) => i.to)).toEqual(['/terms', '/privacy', '/contact']);
  });

  it('menuNav includes /terms, /privacy, and /contact with valid hrefs', () => {
    const hrefs = menuNav.map((i) => i.href);
    expect(hrefs).toContain('/terms');
    expect(hrefs).toContain('/privacy');
    expect(hrefs).toContain('/contact');
  });
});

describe('TASK-10299142: marketplace Stays link goes to a real anchor and keeps the active search', () => {
  const stays = primaryNav.find((item) => item.label === 'Stays')!;
  const search = '?brand=atlastays&checkIn=2026-11-05&checkOut=2026-11-07&guests=2';

  it('marketplace mode: Stays keeps the whole query and targets the #our-homes grid anchor', () => {
    expect(resolveNavTo(stays, { marketplace: true, search })).toBe(
      '/?brand=atlastays&checkIn=2026-11-05&checkOut=2026-11-07&guests=2#our-homes',
    );
  });

  it('marketplace mode without a brand param in the URL still names the marketplace brand', () => {
    expect(resolveNavTo(stays, { marketplace: true, search: '' })).toBe('/?brand=atlastays#our-homes');
    expect(resolveNavTo(stays, { marketplace: true, search: '?guests=3' })).toBe('/?guests=3&brand=atlastays#our-homes');
  });

  it('tenant storefront: Stays is untouched', () => {
    expect(resolveNavTo(stays, { marketplace: false, search })).toBe('/#our-homes');
  });

  it('every other item is untouched in both modes', () => {
    for (const item of primaryNav.filter((i) => i.label !== 'Stays')) {
      expect(resolveNavTo(item, { marketplace: true, search })).toBe(item.to);
      expect(resolveNavTo(item, { marketplace: false, search })).toBe(item.to);
    }
  });
});
