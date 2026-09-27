import { describe, it, expect } from 'vitest';
import { buildReviewClick, googleReviewUrl, isReviewNudgeDue } from './reviewCollection';

describe('TASK-102268 post-stay review collection', () => {
  it('triggers the nudge 2 hours after checkout, once', () => {
    expect(isReviewNudgeDue(0, 2 * 60 * 60_000, false)).toBe(true);
    expect(isReviewNudgeDue(0, 60 * 60_000, false)).toBe(false);
    expect(isReviewNudgeDue(0, 5 * 60 * 60_000, true)).toBe(false);
  });

  it('deep-links to the Google review surface and tracks clicks', () => {
    expect(googleReviewUrl('ChIJabc123')).toContain('writereview?placeid=');
    expect(googleReviewUrl('Sunset Villa Goa')).toContain('maps/search');
    expect(buildReviewClick('b1', 'google', 999)).toEqual({ bookingId: 'b1', channel: 'google', clickedAtMs: 999 });
  });
});
