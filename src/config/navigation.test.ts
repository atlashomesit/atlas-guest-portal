import { describe, expect, it } from 'vitest';
import {
  helpNav,
  primaryNav,
  footerLegalNav,
  menuNav,
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
