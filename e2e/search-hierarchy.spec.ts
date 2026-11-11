import { test, expect, type BrowserContext } from '@playwright/test';

// Run with the Atlas E2E toolchain against a local application preview only.
const base = process.env.GUEST_UX_BASE_URL ?? 'http://127.0.0.1:5843';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Synthetic UX checks require a local preview');

async function fixture(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem('atlas.cookieConsent.v1', JSON.stringify({ choice: 'rejected', at: '2026-10-11T10:00:00Z', noticeVersion: '2026-04-22' }));
    localStorage.setItem('atlas_cookie_consent', 'necessary');
  });
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url()); const p = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.includes('atlas-runtime-config.json')) return json({ apiBaseUrl: url.origin, tenantKey: 'calendar-fixture', environment: 'local' });
    if (p.includes('/tenants/from-domain')) return json({ tenantSlug: 'calendar-fixture', brandName: 'Cedar House', effectiveThemeId: 'classic', bookingMode: 'ONLINE', guestCommsBrandingMode: 'Neutral', legalContactPack: { displayName: 'Cedar House', showAtlasFooterCredit: false, isCustomDomain: true } });
    if (p.endsWith('/listings/public')) return json([{ id: 9001, propertyId: 9000, name: 'Garden Suite', propertyName: 'Cedar House', propertyAddress: 'Goa', baseNightlyRate: 3500, maxGuests: 2, isGstRegistered: false, publishStatus: 'Published', photoUrls: [] }]);
    if (p.endsWith('/availability-batch')) return json({ availableListingIds: [9001] });
    if (p.endsWith('/pricing/daily-summary')) return json({ date: '2026-10-11', listings: [{ listingId: 9001, listingName: 'Garden Suite', baseAmount: 3500, discountAmount: 0, convenienceFeePercent: 1, finalAmount: 3535, globalDiscountPercent: 0 }] });
    if (['fetch', 'xhr'].includes(request.resourceType()) && !/^\/(src|node_modules|@)/.test(p)) return json([]);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['GET', 'HEAD'].includes(request.method())) return route.abort();
    return route.continue();
  });
}

for (const phone of [false, true]) {
  test.describe(phone ? 'phone touch' : 'desktop keyboard', () => {
    test.use({ viewport: phone ? { width: 393, height: 727 } : { width: 1280, height: 720 }, hasTouch: phone });
    test.beforeEach(async ({ context, page }) => {
      await fixture(context);
      await page.clock.setFixedTime(new Date('2026-10-11T10:00:00Z'));
      await page.goto(`${base}/search?checkIn=2026-10-20&checkOut=2026-10-23&guests=2`);
      await expect(page.getByTestId('search-results-h1')).toContainText('1 home');
    });
    test('secondary filters preserve automatic URL updates and visible scope when closed', async ({ page }) => {
      const details = page.getByTestId('search-secondary-filters');
      const summary = details.locator('summary');
      await expect(details).not.toHaveAttribute('open', '');
      if (phone) await summary.tap(); else { await summary.focus(); await page.keyboard.press('Enter'); }
      await expect(details).toHaveAttribute('open', '');
      const ac = page.getByRole('button', { name: 'AC', exact: true });
      if (phone) await ac.tap(); else { await ac.focus(); await page.keyboard.press('Space'); }
      await expect(page).toHaveURL(/amenities=AC/);
      await expect(page.getByTestId('search-results-h1')).toContainText('0 homes');
      if (phone) await summary.tap(); else { await summary.focus(); await page.keyboard.press('Enter'); }
      await expect(ac).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Remove filter AC', exact: true })).toBeVisible();
      await expect(page.getByTestId('search-active-filter-badge')).toHaveText('2');
      await page.getByRole('button', { name: 'Remove filter AC', exact: true }).click();
      await expect(page.getByTestId('search-results-h1')).toContainText('1 home');
      await expect(details).not.toHaveAttribute('open', '');
    });
    test('dates, guests, sort and result modes remain directly reachable', async ({ page }) => {
      await page.locator('#filter-guests').fill('3');
      await expect(page).toHaveURL(/guests=3/);
      await page.locator('#filter-guests').fill('2');
      await page.locator('#filter-checkin').fill('2026-11-02');
      await page.locator('#filter-checkout').fill('2026-11-05');
      await expect(page).toHaveURL(/checkIn=2026-11-02/);
      await expect(page).toHaveURL(/checkOut=2026-11-05/);
      await page.locator('#sort-by').selectOption('price_desc');
      await expect(page).toHaveURL(/sortBy=price_desc/);
      await page.getByTestId('search-view-map').click();
      await expect(page.getByTestId('search-view-map')).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('search-view-list').click();
      await expect(page.getByTestId('search-view-list')).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  });
}
