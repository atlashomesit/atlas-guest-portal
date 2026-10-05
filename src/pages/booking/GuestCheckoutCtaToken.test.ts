/**
 * TASK-102713: checkout + listing + widget CTAs inherit the tenant brand.
 *
 * The checkout Pay button (GuestDetailsPage `.gd-pay`), the listing page's primary
 * button (`.pp-btn-primary`) and the booking widget's Reserve CTA previously used a
 * hard-coded terracotta (#c04528 / coral gradient) on every tenant. This pins the
 * token mapping so a white-label host's guest sees one brand from home to Pay:
 * `--gd-coral` -> `var(--cta-primary)`, `--gd-coral-dark` ->
 * `var(--cta-primary-hover)`, labels -> `var(--text-on-cta)`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', '..');

const read = (rel: string): string => readFileSync(resolve(SRC, rel), 'utf8');

describe('checkout/listing/widget CTA brand tokens (TASK-102713)', () => {
  it('checkout palette aliases the tenant CTA tokens', () => {
    const css = read('pages/booking/GuestDetailsPage.tsx');
    expect(css).toContain('--gd-coral: var(--cta-primary,');
    expect(css).toContain('--gd-coral-dark: var(--cta-primary-hover,');
  });

  it('.gd-pay labels with the on-CTA token, not literal white', () => {
    const css = read('pages/booking/GuestDetailsPage.tsx');
    const payRule = css.match(/\.gd-pay \{[^}]*\}/)?.[0] ?? '';
    expect(payRule).toContain('var(--text-on-cta,');
  });

  it('no hard-coded terracotta fill remains in the checkout page', () => {
    const css = read('pages/booking/GuestDetailsPage.tsx');
    expect(css).not.toMatch(/background:\s*#c04528/i);
  });

  it('listing primary button uses the tenant CTA tokens', () => {
    const css = read(
      'components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.css',
    );
    expect(css).toContain('.pp-btn-primary');
    expect(css).toMatch(/\.pp-btn-primary \{[^}]*var\(--cta-primary/);
    expect(css).toMatch(/\.pp-btn-primary \{[^}]*var\(--text-on-cta/);
  });

  it('widget Reserve CTA uses the tenant CTA tokens with a flat fallback', () => {
    const src = read('components/availability/UnitBookingWidget.tsx');
    expect(src).toContain('var(--cta-primary, #c04528)');
    expect(src).toContain('var(--text-on-cta, #fff)');
  });
});
