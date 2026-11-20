import { describe, expect, it } from 'vitest';
import { guestCapacityHint, guestCapacityMismatchMessage, parseBedroomCount } from './guestCapacityHint';

describe('parseBedroomCount (GUEST-066)', () => {
  it.each([
    ['Nightnest-4 BHK Homestay', 4],
    ['4 BHK', 4],
    ['3-bhk', 3],
  ])('reads %s', (text, n) => expect(parseBedroomCount(text)).toBe(n));
});

describe('guestCapacityHint (GUEST-066)', () => {
  it('flags Nightnest 4 BHK with maxGuests 1', () => {
    expect(
      guestCapacityHint({
        maxGuests: 1,
        listingName: 'Nightnest-4 BHK Homestay',
        accommodationType: 'VacationRental',
      }),
    ).toEqual({ bedrooms: 4, guests: 1 });
  });

  it('is null when capacity fits or listing is a dorm', () => {
    expect(guestCapacityHint({ maxGuests: 4, listingName: '4 BHK' })).toBeNull();
    expect(guestCapacityHint({ maxGuests: 1, listingName: '4 BHK', accommodationType: 'HostelDorm' })).toBeNull();
  });
});

describe('guestCapacityMismatchMessage', () => {
  it('names bedrooms and the guest cap', () => {
    expect(guestCapacityMismatchMessage({ bedrooms: 4, guests: 1 })).toMatch(/4-bedroom/);
    expect(guestCapacityMismatchMessage({ bedrooms: 4, guests: 1 })).toMatch(/up to 1 guest/);
  });
});