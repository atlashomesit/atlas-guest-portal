import { describe, expect, test } from 'vitest';
import { resolveBookingPlanTerms } from '@/utils/bookingPlanTerms';

/**
 * GUEST-068: the booking page says the cancellation rule in the server's own words (the same function the "Your booking" page uses) and, when the API does not
 * send them, falls back to the tier table where an untiered listing is the 7-day default, never an invented 48 hours.
 */
describe('resolveBookingPlanTerms - one cancellation wording (GUEST-068)', () => {
  test("the server's words win over any tier", () => {
    const terms = resolveBookingPlanTerms('BB', 'Flexible', {
      headline: 'Free cancellation until 12:00 AM, 3 Dec',
      detail: 'After that, a late-cancellation fee applies.',
    });
    expect(terms.cancellationHeadline).toBe('Free cancellation until 12:00 AM, 3 Dec');
    expect(terms.cancellationDetail).toBe('After that, a late-cancellation fee applies.');
    expect(terms.mealLabel).toBe('Breakfast included');
  });

  test('a server headline with no detail leaves the detail empty', () => {
    const terms = resolveBookingPlanTerms(null, null, { headline: 'Please check the cancellation terms with your host.', detail: null });
    expect(terms.cancellationHeadline).toBe('Please check the cancellation terms with your host.');
    expect(terms.cancellationDetail).toBeNull();
  });

  test('no policy and no server words says nothing (the block hides; the API now always sends the words, and never invents a Flexible tier)', () => {
    const terms = resolveBookingPlanTerms(null, null);
    expect(terms.cancellationHeadline).toBeNull();
    expect(terms.cancellationDetail).toBeNull();
  });

  test('a named tier still follows the tier table when there are no server words', () => {
    expect(resolveBookingPlanTerms(null, 'Flexible').cancellationHeadline).toBe('Free cancellation up to 48 hours before check-in');
    expect(resolveBookingPlanTerms(null, 'Strict').cancellationDetail).toBe('After that, the booking is non-refundable.');
    expect(resolveBookingPlanTerms(null, 'NonRefundable').cancellationHeadline).toBe('Non-refundable rate');
  });
});
