import { describe, it, expect } from 'vitest';
import {
  bedsLeftForNights,
  dormNeedsGenderAcknowledgement,
  isHostelDormType,
  parseDormGenderPolicy,
  readDormListingFields,
} from './dormListing';

describe('dormListing (HSL-011)', () => {
  it('parses only the three API policy values', () => {
    expect(parseDormGenderPolicy('FemaleOnly')).toBe('FemaleOnly');
    expect(parseDormGenderPolicy('maleonly')).toBe('MaleOnly');
    expect(parseDormGenderPolicy('Mixed')).toBe('Mixed');
    expect(parseDormGenderPolicy('Female')).toBeNull();
    expect(parseDormGenderPolicy(undefined)).toBeNull();
    expect(parseDormGenderPolicy(3)).toBeNull();
  });

  it('only a HostelDorm type is a dorm', () => {
    expect(isHostelDormType('HostelDorm')).toBe(true);
    expect(isHostelDormType(' hosteldorm ')).toBe(true);
    expect(isHostelDormType('Hotel')).toBe(false);
    expect(isHostelDormType(null)).toBe(false);
  });

  it('only women-only / men-only need the acknowledgement', () => {
    expect(dormNeedsGenderAcknowledgement('FemaleOnly')).toBe(true);
    expect(dormNeedsGenderAcknowledgement('MaleOnly')).toBe(true);
    expect(dormNeedsGenderAcknowledgement('Mixed')).toBe(false);
    expect(dormNeedsGenderAcknowledgement(null)).toBe(false);
  });

  it('reads the dorm fields from camelCase or PascalCase payloads and never from the name', () => {
    expect(
      readDormListingFields({ name: '6-Bed Female-Only Dorm', accommodationType: 'HostelDorm', dormGenderPolicy: 'MaleOnly', quantity: 6 }),
    ).toEqual({ accommodationType: 'HostelDorm', dormGenderPolicy: 'MaleOnly', bedCount: 6 });
    expect(readDormListingFields({ AccommodationType: 'HostelDorm', DormGenderPolicy: 'FemaleOnly', Quantity: 8 })).toEqual({
      accommodationType: 'HostelDorm',
      dormGenderPolicy: 'FemaleOnly',
      bedCount: 8,
    });
    expect(readDormListingFields({ name: '6-Bed Female-Only Dorm' })).toEqual({
      accommodationType: null,
      dormGenderPolicy: null,
      bedCount: null,
    });
    expect(readDormListingFields({ quantity: 0 }).bedCount).toBeNull();
    expect(readDormListingFields(null).bedCount).toBeNull();
  });

  it('beds left is the smallest free count across the nights, and null when any night is unknown', () => {
    const map = new Map([['2026-11-01', 5], ['2026-11-02', 3], ['2026-11-03', 4]]);
    expect(bedsLeftForNights(['2026-11-01', '2026-11-02'], map)).toBe(3);
    expect(bedsLeftForNights(['2026-11-01'], map)).toBe(5);
    expect(bedsLeftForNights(['2026-11-01', '2026-11-02', '2026-11-03'], map)).toBe(3);
    expect(bedsLeftForNights(['2026-11-01', '2026-11-09'], map)).toBeNull();
    expect(bedsLeftForNights([], map)).toBeNull();
  });
});
