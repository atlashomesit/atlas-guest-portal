import { describe, expect, it } from 'vitest';
import { sanitizeReviewText, stripHtmlPreservingEmoticons } from './sanitizeReviewText';

describe('TASK-10299094 — sanitizeReviewText & stripHtmlPreservingEmoticons', () => {
  it('preserves "<3" heart emoticons and comparisons without stripping text between "<" and ">"', () => {
    const input = 'We loved it <3 great value, rooms < 20 sqm but fine > expected, price <5000 INR';
    expect(stripHtmlPreservingEmoticons(input)).toBe(
      'We loved it <3 great value, rooms < 20 sqm but fine > expected, price <5000 INR',
    );
  });

  it('strips actual HTML tags like <b> and <script>', () => {
    const input = '<b>bold</b> nice <script>alert(1)</script> ok';
    expect(stripHtmlPreservingEmoticons(input)).toBe('bold nice alert(1) ok');
  });

  it('handles null, undefined, and empty string', () => {
    expect(stripHtmlPreservingEmoticons(null)).toBe('');
    expect(stripHtmlPreservingEmoticons(undefined)).toBe('');
    expect(stripHtmlPreservingEmoticons('')).toBe('');
    expect(sanitizeReviewText('   ')).toBe('');
  });

  it('preserves multiple heart emoticons in sequence or mixed with tags', () => {
    const input = '<p>Amazing stay! <3 <3 <3 Will return!</p>';
    expect(sanitizeReviewText(input)).toBe('Amazing stay! <3 <3 <3 Will return!');
  });
});
