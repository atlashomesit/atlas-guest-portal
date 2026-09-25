import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TASK-102422 — tenant sites must be indexable (robots.txt Allow: / in prod), while
 * private guest reservation pages stay out of search engines via per-page noindex.
 *
 * The robots.txt half is already pinned by functions/robots.txt.test.ts (TASK-7866).
 * This ratchet pins the second half: reservation-flow pages carry noindex so the
 * permissive robots.txt cannot expose token-gated booking pages to crawlers.
 */
describe('TASK-102422 reservation pages stay noindexed', () => {
  it('BookingConfirmationPage renders SEO with noindex', () => {
    const content = readFileSync(resolve(__dirname, '../BookingConfirmationPage.tsx'), 'utf-8');
    expect(content).toMatch(/<SEO[\s\S]{0,400}robots="noindex, nofollow"/);
  });

  it('Reserve (checkout review step) renders SEO with noindex', () => {
    const content = readFileSync(resolve(__dirname, '../Reserve.tsx'), 'utf-8');
    expect(content).toMatch(/<SEO[\s\S]{0,400}robots="noindex, nofollow"/);
  });
});
