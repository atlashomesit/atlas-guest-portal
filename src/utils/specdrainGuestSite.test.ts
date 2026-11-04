import { describe, expect, it } from 'vitest';
import {
  describeRatePlanCancellation,
  resolveFreeCancellationTrustCopy,
  withRatePlanCancellation,
} from './cancellationPolicy';
import { describeIncludedGuests, readIncludedGuestFields } from './includedGuests';
import { collectListingCities, formatCityList, resolveHomesPlace } from './listingCities';
import { keepSimilarStaysInSameCity } from './marketplaceBackHref';
import { policySections } from '../content/legal/policies';
import { termsSections } from '../content/legal/terms';

const base = {
  headline: 'Full refund any time before check-in',
  description: 'generic',
  steps: [{ title: 'a' }, { title: 'b' }],
};

describe('GUEST-059: one cancellation answer per rate plan', () => {
  it('a non-refundable plan replaces the "full refund any time" block and drops the refund steps', () => {
    const plan = describeRatePlanCancellation('NonRefundable', 'Non-refundable, lowest price');
    const out = withRatePlanCancellation(base, plan, true);
    expect(out.headline).toBe('Non-refundable, lowest price');
    expect(out.headline).not.toMatch(/full refund any time/i);
    expect(out.steps).toEqual([]);
    expect(out.description).toMatch(/not refundable/i);
  });

  it('a plan with its own days shows those days and keeps the refund steps', () => {
    const plan = describeRatePlanCancellation('Flexible', 'Free cancellation up to 7 days before check-in');
    const out = withRatePlanCancellation(base, plan, true);
    expect(out.headline).toBe('Free cancellation up to 7 days before check-in');
    expect(out.steps).toHaveLength(2);
  });

  it('with no plan wording the listing block is untouched', () => {
    expect(describeRatePlanCancellation('Flexible', null)).toBeNull();
    expect(withRatePlanCancellation(base, null, true)).toBe(base);
  });

  it('the booking-box fallback line uses the plan summary instead of the tier prose', () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const copy = resolveFreeCancellationTrustCopy({
      checkInDate: soon,
      tier: 'Flexible',
      planSummary: 'Free cancellation up to 7 days before check-in',
    });
    expect(copy.trustMessage).toBe('Free cancellation up to 7 days before check-in');
  });

  it('terms and policies no longer restate a fixed 15 / 7-15 day refund schedule that contradicts a listing', () => {
    const text = [
      ...termsSections
        .filter((s) => s.id === 'cancellations-refunds')
        .flatMap((s) => [s.summary, ...(s.body ?? [])]),
      ...policySections
        .filter((s) => s.id === 'cancellation-refunds')
        .flatMap((s) => [s.summary, ...s.details]),
    ].join('\n');
    expect(text).not.toMatch(/15 days|7–15|100% refund|50% refund|full refund/i);
    expect(text).toMatch(/listing/i);
    expect(text).toMatch(/contact the host/i);
  });
});

describe('GUEST-060: included guests line', () => {
  const inr = (n: number) => `₹${n}`;
  it('names the included count and the extra-guest rate for the host that set them', () => {
    expect(describeIncludedGuests(2, 500, 8, inr)).toBe('Includes 2 guests, then ₹500 per extra guest per night');
    expect(describeIncludedGuests(4, 1200, 6, inr)).toBe('Includes 4 guests, then ₹1200 per extra guest per night');
  });
  it('no extra-guest clause when none is set or the home sleeps only the included guests', () => {
    expect(describeIncludedGuests(2, null, 8, inr)).toBe('Includes 2 guests');
    expect(describeIncludedGuests(3, 500, 3, inr)).toBe('Includes 3 guests');
    expect(describeIncludedGuests(1, null, 2, inr)).toBe('Includes 1 guest');
  });
  it('says nothing when the API sends no included count', () => {
    expect(describeIncludedGuests(null, 500, 8, inr)).toBeNull();
    expect(readIncludedGuestFields({})).toEqual({ includedGuests: null, extraGuestRate: null });
    expect(readIncludedGuestFields({ baseOccupancy: 3, extraGuestRate: '700' })).toEqual({
      includedGuests: 3,
      extraGuestRate: 700,
    });
  });
});

describe('GUEST-061: cities come from the listings', () => {
  const demo = [
    { city: 'Udaipur' },
    { city: 'Udaipur' },
    { city: 'Ooty' },
    { city: 'Goa' },
    { city: 'Coorg' },
    { city: 'Jaipur' },
    { city: 'Kakinada' },
    { city: 'kakinada' },
    { city: null },
    {},
  ];
  it('lists every real city, most homes first, ignoring case and blanks', () => {
    expect(collectListingCities(demo)).toEqual(['Udaipur', 'Kakinada', 'Ooty', 'Goa', 'Coorg', 'Jaipur']);
    expect(formatCityList(collectListingCities(demo))).toBe('Udaipur, Kakinada, Ooty, Goa, Coorg and Jaipur');
  });
  it('a one-city host still reads as that city; a two-city host names both', () => {
    expect(resolveHomesPlace([{ city: 'Hyderabad' }, { city: 'Hyderabad' }], 'Kakinada')).toBe('Hyderabad');
    expect(resolveHomesPlace([{ city: 'Pune' }, { city: 'Goa' }], 'Pune')).toBe('Pune and Goa');
  });
  it('falls back to the legal-address city only when no listing names one, and says "N cities" past six', () => {
    expect(resolveHomesPlace([{}, { city: '' }], 'Kakinada')).toBe('Kakinada');
    expect(resolveHomesPlace([], null)).toBeNull();
    expect(formatCityList(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe('7 cities');
  });
});

describe('GUEST-062: similar stays are the same city', () => {
  const items = [{ id: 1, city: 'Jaipur' }, { id: 2, city: 'udaipur ' }, { id: 3 }, { id: 4, City: 'Udaipur' }];
  it('drops other cities, keeps same-city and unknown-city items', () => {
    expect(keepSimilarStaysInSameCity(items, 'Udaipur').map((i) => i.id)).toEqual([2, 3, 4]);
  });
  it('keeps everything when the viewed listing has no city', () => {
    expect(keepSimilarStaysInSameCity(items, null)).toHaveLength(4);
  });
});
