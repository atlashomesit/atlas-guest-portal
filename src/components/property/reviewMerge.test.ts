import { describe, expect, it } from 'vitest';
import {
  formatReviewLocaleLabel,
  isGenericReviewerName,
  mergeListingAndExternalReviews,
  normalizeReviewLocale,
  resolveReviewerName,
  stripReviewScraperBoilerplate,
  type ExternalReviewRow,
  type ListingReviewRow,
} from './reviewMerge';

describe('mergeListingAndExternalReviews (TASK-103146)', () => {
  it('suppresses external reviews with rating less than 4 stars or null rating', () => {
    const external: ExternalReviewRow[] = [
      { guestName: 'Alice', rating: 5, body: 'Super clean and spacious!', reviewDate: '2026-07-20', source: 'Airbnb' },
      { guestName: 'Bob', rating: 4, body: 'Good place, easy checkin.', reviewDate: '2026-07-21', source: 'Google' },
      { guestName: 'Charlie', rating: 3, body: 'Average stay, noisy street.', reviewDate: '2026-07-22', source: 'Airbnb' },
      { guestName: 'Dave', rating: 2, body: 'Not as described.', reviewDate: '2026-07-23', source: 'Booking.com' },
      { guestName: 'Praveen Yerra', rating: 1, body: null, reviewDate: '2026-07-20', source: 'Airbnb' },
      { guestName: 'Eve', rating: null, body: 'Unrated review text', reviewDate: '2026-07-24', source: 'Google' },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.guestName)).toEqual(['Bob', 'Alice']);
    expect(result.every((r) => r.rating >= 4)).toBe(true);
  });

  it('suppresses hidden reviews (isHidden: true) from both native and external reviews', () => {
    const native: ListingReviewRow[] = [
      { id: 301, guestName: 'Visible Native', rating: 5, body: 'Great stay', isHidden: false, createdAt: '2026-08-01T12:00:00Z' },
      { id: 302, guestName: 'Hidden Native', rating: 5, body: 'Disputed stay', isHidden: true, createdAt: '2026-08-02T12:00:00Z' },
    ];
    const external: ExternalReviewRow[] = [
      { guestName: 'Visible External', rating: 5, body: 'Great external stay', isHidden: false, reviewDate: '2026-08-01', source: 'Google' },
      { guestName: 'Hidden External', rating: 5, body: 'Hidden external stay', isHidden: true, reviewDate: '2026-08-02', source: 'Airbnb' },
    ];

    const result = mergeListingAndExternalReviews(native, external);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.guestName)).toEqual(['Visible Native', 'Visible External']);
  });

  it('suppresses external reviews with empty or whitespace-only bodies even if rating is 5', () => {
    const external: ExternalReviewRow[] = [
      { guestName: 'Real Reviewer', rating: 5, body: 'Loved the sunrise view from the balcony!', reviewDate: '2026-08-01', source: 'Airbnb' },
      { guestName: 'Empty Body 1', rating: 5, body: null, reviewDate: '2026-08-02', source: 'Airbnb' },
      { guestName: 'Empty Body 2', rating: 5, body: '   ', reviewDate: '2026-08-03', source: 'Google' },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe('Real Reviewer');
  });

  it('TASK-10299093: suppresses native reviews with empty or whitespace-only bodies even if title or 5-star rating is present', () => {
    const native: ListingReviewRow[] = [
      { id: 201, guestName: 'Has Body', rating: 5, body: 'Loved the room and amenities!', title: 'Great stay', createdAt: '2026-08-01T12:00:00Z' },
      { id: 202, guestName: 'Empty Body Null', rating: 5, body: null, title: 'Five star title only', createdAt: '2026-08-02T12:00:00Z' },
      { id: 203, guestName: 'Whitespace Body', rating: 5, body: '   \n  \t  ', title: 'Spaces only', createdAt: '2026-08-03T12:00:00Z' },
      { id: 204, guestName: 'Empty String Body', rating: 5, body: '', title: null, createdAt: '2026-08-04T12:00:00Z' },
    ];

    const result = mergeListingAndExternalReviews(native, []);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(201);
    expect(result[0].guestName).toBe('Has Body');
  });

  it('TASK-10299094: does not corrupt "<3" hearts or "< ... >" text in review bodies while stripping HTML tags', () => {
    const external: ExternalReviewRow[] = [
      {
        guestName: 'Heart Lover',
        rating: 5,
        body: 'We loved it <3 great value, rooms < 20 sqm but fine > expected, price <5000 INR',
        reviewDate: '2026-08-01',
        source: 'Airbnb',
      },
      {
        guestName: 'Tag User',
        rating: 5,
        body: '<b>bold</b> nice <script>alert(1)</script> ok <3',
        reviewDate: '2026-08-02',
        source: 'Google',
      },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(2);
    const heartReview = result.find((r) => r.guestName === 'Heart Lover');
    expect(heartReview?.body).toBe(
      'We loved it <3 great value, rooms < 20 sqm but fine > expected, price <5000 INR',
    );

    const tagReview = result.find((r) => r.guestName === 'Tag User');
    expect(tagReview?.body).toBe('bold nice alert(1) ok <3');
  });

  it('suppresses native reviews with rating less than 4 stars', () => {
    const native: ListingReviewRow[] = [
      { id: 101, guestName: 'Five Star', rating: 5, body: 'Flawless hospitality!', createdAt: '2026-08-10T12:00:00Z' },
      { id: 102, guestName: 'Four Star', rating: 4, body: 'Very nice property.', createdAt: '2026-08-11T12:00:00Z' },
      { id: 103, guestName: 'Three Star', rating: 3, body: 'Could be cleaner.', createdAt: '2026-08-12T12:00:00Z' },
      { id: 104, guestName: 'One Star', rating: 1, body: 'Bad experience.', createdAt: '2026-08-13T12:00:00Z' },
    ];

    const result = mergeListingAndExternalReviews(native, []);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([102, 101]);
  });

  it('honestly attributes review sources for Google, Airbnb, and Booking.com', () => {
    const external: ExternalReviewRow[] = [
      { rating: 5, body: 'Great Airbnb stay!', reviewDate: '2026-07-15', source: 'Airbnb' },
      { rating: 5, body: 'Great Booking stay!', reviewDate: '2026-07-16', source: 'Booking.com' },
      { rating: 5, body: 'Great Google stay!', reviewDate: '2026-07-17', source: 'Google' },
    ];

    const result = mergeListingAndExternalReviews([], external);

    const googleReview = result.find((r) => r.source === 'Google');
    const airbnbReview = result.find((r) => r.source === 'Airbnb');
    const bookingReview = result.find((r) => r.source === 'Booking.com');

    expect(googleReview?.isGoogle).toBe(true);
    expect(airbnbReview?.isGoogle).toBe(false);
    expect(bookingReview?.isGoogle).toBe(false);

    expect(airbnbReview?.guestName).toBe('Airbnb guest');
    expect(bookingReview?.guestName).toBe('Booking.com guest');
    expect(googleReview?.guestName).toBe('Google user');
  });

  it('sorts merged native and external reviews newest-first', () => {
    const native: ListingReviewRow[] = [
      { id: 1, guestName: 'Native Newer', rating: 5, body: 'Fresh direct booking review', createdAt: '2026-09-01T00:00:00Z' },
      { id: 2, guestName: 'Native Older', rating: 5, body: 'Older direct booking review', createdAt: '2026-07-01T00:00:00Z' },
    ];
    const external: ExternalReviewRow[] = [
      { guestName: 'Ext Mid', rating: 5, body: 'August Airbnb review', reviewDate: '2026-08-15', source: 'Airbnb' },
    ];

    const result = mergeListingAndExternalReviews(native, external);

    expect(result.map((r) => r.guestName)).toEqual(['Native Newer', 'Ext Mid', 'Native Older']);
  });

  it('maps host responses and responded timestamps from external reviews (REV-014)', () => {
    const external: ExternalReviewRow[] = [
      {
        guestName: 'Alice',
        rating: 5,
        body: 'Fantastic villa experience!',
        reviewDate: '2026-10-01',
        source: 'Airbnb',
        hostResponse: '  Thank you for being great guests!  ',
        respondedAt: '2026-10-02T10:00:00.000Z',
      },
      {
        guestName: 'Bob',
        rating: 4,
        body: 'Nice stay overall.',
        reviewDate: '2026-10-02',
        source: 'Google',
        hostResponse: null,
      },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(2);
    const alice = result.find((r) => r.guestName === 'Alice');
    const bob = result.find((r) => r.guestName === 'Bob');

    expect(alice?.hostResponse).toBe('Thank you for being great guests!');
    expect(alice?.hostResponseAt).toBe('2026-10-02T10:00:00.000Z');
    expect(bob?.hostResponse).toBeNull();
    expect(bob?.hostResponseAt).toBeNull();
  });

  it('normalizes legacy AtlasSyncBookingCom and AtlasSync sources to Booking.com (REV-011)', () => {
    const external: ExternalReviewRow[] = [
      {
        guestName: 'Kiran',
        rating: 5,
        body: 'Superb hotel apartment experience!',
        reviewDate: '2026-10-05',
        source: 'AtlasSyncBookingCom',
      },
      {
        guestName: 'Rohit',
        rating: 4,
        body: 'Great location and hospitality',
        reviewDate: '2026-10-06',
        source: 'AtlasSync',
      },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.source)).toEqual(['Booking.com', 'Booking.com']);
    expect(result.map((r) => r.guestName)).toEqual(['Rohit', 'Kiran']);
    expect(result.every((r) => !r.isGoogle)).toBe(true);
  });

  it('strips OTA scraper boilerplate prefixes and filters boilerplate-only bodies (TASK-10298750)', () => {
    expect(
      stripReviewScraperBoilerplate('Headline: Amazing stay\nPublic review: Super clean rooms and warm host!\nPositive: Location'),
    ).toBe('Amazing stay\nSuper clean rooms and warm host!\nLocation');
    expect(stripReviewScraperBoilerplate('Public review:\nHeadline:\nPositive:')).toBe('');

    const external: ExternalReviewRow[] = [
      {
        guestName: 'Meera',
        rating: 5,
        body: 'Public review: Loved the balcony and coffee!',
        reviewDate: '2026-10-07',
        source: 'Airbnb',
      },
      {
        guestName: 'Boilerplate Only',
        rating: 5,
        body: 'Public review: \nHeadline: ',
        reviewDate: '2026-10-08',
        source: 'Booking.com',
      },
    ];

    const result = mergeListingAndExternalReviews([], external);
    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe('Meera');
    expect(result[0].body).toBe('Loved the balcony and coffee!');
  });
});


describe('REV-041: author name and locale on external review rows', () => {
  it('carries authorName and a normalised locale through the merge', () => {
    const external: ExternalReviewRow[] = [
      {
        guestName: 'Hans M.',
        authorName: 'Hans Müller',
        locale: 'de-DE',
        rating: 5,
        body: 'Wunderbarer Aufenthalt.',
        reviewDate: '2026-10-01',
        source: 'Airbnb',
      },
      { guestName: 'Priya', rating: 5, body: 'Lovely stay.', reviewDate: '2026-10-02', source: 'Airbnb' },
    ];

    const result = mergeListingAndExternalReviews([], external);

    const hans = result.find((r) => r.body === 'Wunderbarer Aufenthalt.')!;
    expect(hans.authorName).toBe('Hans Müller');
    expect(hans.locale).toBe('de-DE');
    expect(hans.guestName).toBe('Hans M.');
    const priya = result.find((r) => r.body === 'Lovely stay.')!;
    expect(priya.authorName ?? null).toBeNull();
    expect(priya.locale ?? null).toBeNull();
  });

  it('shows the real author name when the stored guest name is the generic OTA placeholder', () => {
    const external: ExternalReviewRow[] = [
      { guestName: 'Guest', authorName: 'Amelie Dubois', locale: 'fr-FR', rating: 5, body: 'Superbe séjour.', reviewDate: '2026-10-03', source: 'Airbnb' },
      { guestName: '  ', authorName: 'Kenji Sato', rating: 5, body: 'Great host.', reviewDate: '2026-10-02', source: 'Booking.com' },
      { guestName: 'Guest', rating: 5, body: 'No author given.', reviewDate: '2026-10-01', source: 'Airbnb' },
    ];

    const result = mergeListingAndExternalReviews([], external);

    expect(result.map((r) => r.guestName)).toEqual(['Amelie Dubois', 'Kenji Sato', 'Guest']);
  });

  it('keeps a real guest name over the author name', () => {
    const external: ExternalReviewRow[] = [
      { guestName: 'Ravi K', authorName: 'Ravi Kumar', rating: 5, body: 'Peaceful.', reviewDate: '2026-10-01', source: 'Airbnb' },
    ];
    const result = mergeListingAndExternalReviews([], external);
    expect(result[0].guestName).toBe('Ravi K');
  });

  it('drops a malformed locale instead of rendering it', () => {
    const external: ExternalReviewRow[] = [
      { guestName: 'A', locale: '<img src=x onerror=alert(1)>', rating: 5, body: 'One.', reviewDate: '2026-10-03', source: 'Airbnb' },
      { guestName: 'B', locale: '   ', rating: 5, body: 'Two.', reviewDate: '2026-10-02', source: 'Airbnb' },
      { guestName: 'C', locale: 'pt_BR', rating: 5, body: 'Three.', reviewDate: '2026-10-01', source: 'Airbnb' },
    ];
    const result = mergeListingAndExternalReviews([], external);
    expect(result.map((r) => r.locale ?? null)).toEqual([null, null, 'pt-BR']);
  });
});

describe('REV-041: reviewer name and locale helpers', () => {
  it('isGenericReviewerName flags only placeholder names', () => {
    expect(isGenericReviewerName('Guest')).toBe(true);
    expect(isGenericReviewerName('  guest ')).toBe(true);
    expect(isGenericReviewerName('A guest')).toBe(true);
    expect(isGenericReviewerName('')).toBe(true);
    expect(isGenericReviewerName(null)).toBe(true);
    expect(isGenericReviewerName('Guest House Fan')).toBe(false);
    expect(isGenericReviewerName('Amelie')).toBe(false);
  });

  it('resolveReviewerName prefers a real guest name, then the author name, then whatever was stored', () => {
    expect(resolveReviewerName('Ravi K', 'Ravi Kumar')).toBe('Ravi K');
    expect(resolveReviewerName('Guest', 'Amelie Dubois')).toBe('Amelie Dubois');
    expect(resolveReviewerName(null, 'Amelie Dubois')).toBe('Amelie Dubois');
    expect(resolveReviewerName('Guest', null)).toBe('Guest');
    expect(resolveReviewerName('Guest', '  ')).toBe('Guest');
    expect(resolveReviewerName(null, null)).toBeNull();
    expect(resolveReviewerName('', '')).toBeNull();
  });

  it('normalizeReviewLocale accepts BCP-47 style codes only', () => {
    expect(normalizeReviewLocale('fr-FR')).toBe('fr-FR');
    expect(normalizeReviewLocale(' pt_BR ')).toBe('pt-BR');
    expect(normalizeReviewLocale('en')).toBe('en');
    expect(normalizeReviewLocale('')).toBeNull();
    expect(normalizeReviewLocale(null)).toBeNull();
    expect(normalizeReviewLocale(undefined)).toBeNull();
    expect(normalizeReviewLocale('<b>fr</b>')).toBeNull();
    expect(normalizeReviewLocale('this is not a locale')).toBeNull();
  });

  it('formatReviewLocaleLabel makes a readable language label and falls back to the raw code', () => {
    expect(formatReviewLocaleLabel('fr-FR')).toBe('French (France)');
    expect(formatReviewLocaleLabel('en-IN')).toBe('English (India)');
    expect(formatReviewLocaleLabel('es-ES')).toBe('Spanish (Spain)');
    expect(formatReviewLocaleLabel('de')).toBe('German');
    // Unknown language: the code is all we can honestly show.
    expect(formatReviewLocaleLabel('zz-ZZ')).toBe('zz-ZZ');
    expect(formatReviewLocaleLabel('xx')).toBe('xx');
    expect(formatReviewLocaleLabel('')).toBeNull();
    expect(formatReviewLocaleLabel(null)).toBeNull();
    expect(formatReviewLocaleLabel('<script>')).toBeNull();
  });
});
