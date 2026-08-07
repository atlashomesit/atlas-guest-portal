import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Homepage_PropertyDetails - TASK-1185: notFound heading', () => {
  it('renders "Home not found" recovery message when listing not found', () => {
    const filePath = resolve(__dirname, './Homepage_PropertyDetails.tsx');
    const content = readFileSync(filePath, 'utf-8');

    // TASK-4518 refactored the inline <h1>Home Not Found</h1> into the shared <StateMessage>
    // component. Verify the notFound state renders that "Home not found" recovery message.
    // (Behavioural coverage lives in src/pages/home/__tests__/listing-not-found-recovery.test.tsx.)
    expect(content).toContain('title="Home not found"');
    expect(content).toContain('data-testid="listing-not-found-homepage"');

    // Verify there's a notFound state
    expect(content).toContain('notFound');
    expect(content).toContain('setNotFound');
  });
});

describe('TASK-7430: URL property slug must match listing property slug', () => {
  const SURFACES: Array<{ label: string; path: string }> = [
    { label: 'default', path: resolve(__dirname, './Homepage_PropertyDetails.tsx') },
    { label: 'heritage', path: resolve(__dirname, '../../../themes/heritage/PropertyDetails.tsx') },
  ];

  for (const { label, path } of SURFACES) {
    it(`${label}: enforces urlPropertySlugMatches before rendering a listing-id match`, () => {
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('urlPropertySlugMatches');
      expect(content).toContain('TASK-7430');

      // The INVARIANT (not the phrasing): inside the `foundByListingId` block, the listing must
      // never be rendered without the URL's property slug having been checked first. Asserted
      // structurally rather than by matching one exact `if (...)` spelling, because the guard has
      // legitimately been expressed both ways:
      //   TASK-7430 (2026-08-04): `if (!urlPropertySlugMatches(x)) { setNotFound(); return; }`
      //   TASK-7448 (d9a030c2, 2026-08-07): `if (urlPropertySlugMatches(x)) { setData(...); return; }`
      //     then deliberately FALLS THROUGH on mismatch instead of 404ing, because a bundled-catalog
      //     listingId 1-7 can collide with a real tenant listing PK (e.g. the e2e-wa-only fixture
      //     id=1) and must be re-resolved via the tenant-scoped GET /listings/{id}.
      // Both satisfy TASK-7430's actual guarantee: no render on an unverified slug. Pinning the
      // negated spelling made this test fail the moment the safer fall-through landed, which is a
      // false red, not a caught regression.
      const blockStart = content.indexOf('if (foundByListingId) {');
      expect(blockStart).toBeGreaterThan(-1);

      const guardAt = content.indexOf('urlPropertySlugMatches(foundByListingId)', blockStart);
      const renderAt = content.indexOf('setData(', blockStart);
      expect(guardAt).toBeGreaterThan(-1);
      expect(renderAt).toBeGreaterThan(-1);
      // The slug check must appear before the first setData() reachable from this block.
      expect(guardAt).toBeLessThan(renderAt);
    });
  }
});

/**
 * TASK-7012 (founder ruling, 2026-08-03): the listing-detail cancellation panel must NOT disclose the
 * universal post-booking grace window. It renders before the guest picks dates, so there is nothing to
 * void against — and atlas-api VOIDS the window when check-in falls inside it from booking time
 * (`CancellationPolicyWindow.ComputeEffectiveFreeCancellationDeadlineUtc`), so a same-day or next-day
 * booker gets no grace refund at all. A listing-level `graceHours` only means the feature is enabled
 * for that listing. The grace window is disclosed ONLY by the booking widget's grace strip, which
 * gates on `resolveApplicableGraceHours` (see UnitBookingWidget.test.tsx).
 *
 * Guest-facing cancellation over-promises are a top churn risk, so this is guarded at the source level
 * on BOTH surfaces — `src/themes/heritage/PropertyDetails.tsx` is a fork of the default page and the
 * two carried byte-identical copy, so a fix applied to one only would silently regress the other.
 */
describe('TASK-7012: listing-detail panels never advertise the grace window', () => {
  const SURFACES: Array<{ label: string; path: string }> = [
    { label: 'default', path: resolve(__dirname, './Homepage_PropertyDetails.tsx') },
    { label: 'heritage', path: resolve(__dirname, '../../../themes/heritage/PropertyDetails.tsx') },
  ];

  for (const { label, path } of SURFACES) {
    it(`${label}: cancellation panel makes no post-booking free-cancellation promise`, () => {
      const content = readFileSync(path, 'utf-8');

      // The exact over-promise this task removed, plus the clause that made it unconditional.
      expect(content).not.toContain('cancel free within');
      expect(content).not.toContain('regardless of this policy');

      // Any other phrasing of the same promise — "N hours of booking" / "hours after you book".
      expect(content).not.toMatch(/hours of booking/i);
      expect(content).not.toMatch(/hours after you book/i);
    });

    it(`${label}: getPpCancellationInfo takes no graceHours`, () => {
      const content = readFileSync(path, 'utf-8');
      const fnStart = content.indexOf('function getPpCancellationInfo(');
      expect(fnStart, 'getPpCancellationInfo not found').toBeGreaterThan(-1);
      const fnBody = content.slice(fnStart, content.indexOf('\n}', fnStart));

      // No grace plumbing into the copy builder at all — the panel cannot promise what it cannot see.
      expect(fnBody).not.toContain('graceHours');
      expect(fnBody).not.toContain('graceNote');
    });

    it(`${label}: the panel's call site passes no graceHours`, () => {
      const content = readFileSync(path, 'utf-8');
      const callStart = content.indexOf('getPpCancellationInfo(data.cancellationTier');
      expect(callStart, 'getPpCancellationInfo call site not found').toBeGreaterThan(-1);
      const callSite = content.slice(callStart, content.indexOf('});', callStart));
      expect(callSite).not.toContain('graceHours');
    });
  }

  it('still hands the listing-level graceHours to the widget that gates it correctly', () => {
    // The default page forwards it explicitly; heritage omits the prop so UnitBookingWidget
    // self-resolves it from fetchPublicListings. Either way the widget stays the sole discloser —
    // this fix must not have severed grace disclosure everywhere.
    const defaultPage = readFileSync(SURFACES[0].path, 'utf-8');
    expect(defaultPage).toContain('graceHours={data.graceHours ?? null}');

    const heritage = readFileSync(SURFACES[1].path, 'utf-8');
    expect(heritage).toContain('<UnitBookingWidget');
  });
});

/**
 * Public /listings only returns cover (+ SortOrder==1). Property details must still hydrate the
 * full photoUrls list from GET /listings/{id} so "View gallery" shows every photo — not skip
 * hydration just because a cover image already exists.
 */
describe('Property details hydrates full gallery from listing detail', () => {
  const SURFACES: Array<{ label: string; path: string }> = [
    { label: 'default', path: resolve(__dirname, './Homepage_PropertyDetails.tsx') },
    { label: 'heritage', path: resolve(__dirname, '../../../themes/heritage/PropertyDetails.tsx') },
  ];

  for (const { label, path } of SURFACES) {
    it(`${label}: upgrades property_img when detail returns more photos`, () => {
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('detailPhotosHydratedRef');
      expect(content).toContain('hydratedImages.length > prevGallery.length');
      expect(content).not.toContain('hasGalleryImages && hasHostPhone');
      expect(content).not.toMatch(
        /filterGuestImageUrls\(prev\.property_img \?\? \[\]\)\.length === 0 && hydratedImages\.length > 0/,
      );
    });
  }
});
