import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_GUEST_NAME,
  GUEST_FEEDBACK_LABEL,
  formatGuestFeedbackDate,
  normalizeGuestFeedback,
} from './guestFeedback';

const row = (overrides: Record<string, unknown> = {}) => ({
  guestName: 'Asha',
  rating: 5,
  comment: 'Lovely garden breakfast',
  date: '2026-10-28',
  label: 'Guest feedback',
  ...overrides,
});

describe('normalizeGuestFeedback (REV-046)', () => {
  it('turns API rows into cards with a first name, a rating, a plain comment and a civil date', () => {
    const cards = normalizeGuestFeedback([row({ guestName: '  Asha Rao  ', comment: '  Great <b>stay</b>  ' })]);

    expect(cards).toEqual([
      { key: 'guest-feedback-0', firstName: 'Asha', rating: 5, comment: 'Great stay', date: '2026-10-28' },
    ]);
  });

  it('exports the one label every card carries', () => {
    expect(GUEST_FEEDBACK_LABEL).toBe('Guest feedback');
  });

  it('keeps a heart emoticon and a comparison sign in the note', () => {
    const [card] = normalizeGuestFeedback([row({ comment: 'Loved it <3 — under 20 sqm but cosy' })]);
    expect(card.comment).toBe('Loved it <3 — under 20 sqm but cosy');
  });

  it('never lets an under-4-star note onto a website (founder ruling 2026-10-09)', () => {
    const cards = normalizeGuestFeedback([
      row({ rating: 3, comment: 'AC was loud' }),
      row({ rating: 1, comment: 'Dirty' }),
      row({ rating: 3.9, comment: 'Almost four' }),
      row({ rating: 4, comment: 'Good' }),
    ]);
    expect(cards.map((c) => c.comment)).toEqual(['Good']);
  });

  it('a rating with no comment is not a card', () => {
    const cards = normalizeGuestFeedback([
      row({ comment: '' }),
      row({ comment: '   ' }),
      row({ comment: null }),
      row({ comment: undefined }),
      row({ comment: '<b></b>' }),
    ]);
    expect(cards).toEqual([]);
  });

  it('skips rows that are not usable and sources that are not lists', () => {
    expect(
      normalizeGuestFeedback(null, undefined, 'x', 7, {}, [null, 'x', 7, [], { rating: 'high', comment: 'x' }, row()]),
    ).toHaveLength(1);
  });

  it('falls back to "A guest" when the guest left no name', () => {
    const cards = normalizeGuestFeedback([row({ guestName: null }), row({ guestName: '   ', comment: 'Other' })]);
    expect(cards.map((c) => c.firstName)).toEqual([ANONYMOUS_GUEST_NAME, ANONYMOUS_GUEST_NAME]);
  });

  it('lists newest first and puts an undated note last', () => {
    const cards = normalizeGuestFeedback([
      row({ comment: 'older', date: '2026-09-01' }),
      row({ comment: 'undated', date: undefined }),
      row({ comment: 'newest', date: '2026-10-28' }),
    ]);
    expect(cards.map((c) => c.comment)).toEqual(['newest', 'older', 'undated']);
    expect(cards[2].date).toBe('');
    expect(cards.map((c) => c.key)).toEqual(['guest-feedback-0', 'guest-feedback-1', 'guest-feedback-2']);
  });

  it('shows a note once when the same list arrives from two endpoints', () => {
    const fromReviews = [row(), row({ comment: 'Second note', date: '2026-10-20' })];
    const fromListing = [row(), row({ comment: 'Second note', date: '2026-10-20' })];

    expect(normalizeGuestFeedback(fromReviews, fromListing)).toHaveLength(2);
  });

  it('keeps two different notes from the same guest on the same day', () => {
    expect(normalizeGuestFeedback([row(), row({ comment: 'A different note' })])).toHaveLength(2);
  });

  it('accepts a timestamp and keeps only the date part', () => {
    const [card] = normalizeGuestFeedback([row({ date: '2026-10-28T09:30:00Z' })]);
    expect(card.date).toBe('2026-10-28');
  });
});

describe('formatGuestFeedbackDate (REV-046)', () => {
  it('shows month and year, like the other review cards', () => {
    expect(formatGuestFeedbackDate('2026-10-28')).toBe('October 2026');
  });

  it('keeps the month on the first and last day of a month, in any viewer time zone', () => {
    expect(formatGuestFeedbackDate('2026-11-01')).toBe('November 2026');
    expect(formatGuestFeedbackDate('2026-10-31')).toBe('October 2026');
    expect(formatGuestFeedbackDate('2027-01-01')).toBe('January 2027');
  });

  it('is empty for a missing or malformed date', () => {
    expect(formatGuestFeedbackDate('')).toBe('');
    expect(formatGuestFeedbackDate('soon')).toBe('');
  });
});
