import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeIncludedGuests, pickIncludedGuestFacts, readIncludedGuestFields } from './includedGuests';

/**
 * Seen on hosted dev after the API deploy: GET /api/public/listings/3 and /listings/public both send
 * includedGuests 2 and extraGuestRate 500, but the home page showed no "Includes 2 guests" line, because the
 * page's listing row comes from the catalog or GET /listings/{id}, which drop or never carry those facts.
 */
describe('the included-guests line reads the public listing reply', () => {
  const inr = (n: number) => `₹${n}`;

  it('uses the public reply when the listing row has no facts', () => {
    const facts = pickIncludedGuestFacts(readIncludedGuestFields({ includedGuests: 2, extraGuestRate: 500 }), {});
    expect(describeIncludedGuests(facts.includedGuests, facts.extraGuestRate, 5, inr, facts.priceChangesWithGuests)).toBe(
      'Includes 2 guests, then ₹500 per extra guest per night',
    );
  });

  it('keeps the wording for a price that changes with the guest count, with no number', () => {
    const facts = pickIncludedGuestFacts(readIncludedGuestFields({ includedGuests: 2, priceChangesWithGuests: true }), {});
    expect(describeIncludedGuests(facts.includedGuests, facts.extraGuestRate, 5, inr, facts.priceChangesWithGuests)).toBe(
      'Includes 2 guests. Price changes with the number of guests',
    );
  });

  it('the public reply wins over the listing row', () => {
    const facts = pickIncludedGuestFacts(readIncludedGuestFields({ includedGuests: 3, extraGuestRate: null }), {
      includedGuests: 2,
      extraGuestRate: 500,
    });
    expect(facts).toEqual({ includedGuests: 3, extraGuestRate: null });
  });

  it('falls back to the listing row until the public reply arrives, or if it failed', () => {
    expect(pickIncludedGuestFacts(null, { includedGuests: 2, extraGuestRate: 500, priceChangesWithGuests: null })).toEqual({
      includedGuests: 2,
      extraGuestRate: 500,
    });
  });

  it('shows nothing when neither reply says, never a number made up for every host', () => {
    const facts = pickIncludedGuestFacts(readIncludedGuestFields({ includedGuests: null }), {});
    expect(describeIncludedGuests(facts.includedGuests, facts.extraGuestRate, 5, inr)).toBeNull();
  });

  const SURFACES: Array<{ label: string; path: string }> = [
    { label: 'default', path: resolve(__dirname, '../components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx') },
    { label: 'heritage', path: resolve(__dirname, '../themes/heritage/PropertyDetails.tsx') },
  ];

  for (const { label, path } of SURFACES) {
    it(`${label}: stores the facts from the public reply and uses them for both the card and the booking box`, () => {
      const content = readFileSync(path, 'utf-8');
      expect(content).toContain('setPublicGuestFacts(readIncludedGuestFields(publicPayload');
      expect(content).toContain('pickIncludedGuestFacts(publicGuestFacts, data)');
      expect(content).not.toContain('describeIncludedGuests(data.includedGuests');
      expect(content).not.toContain('includedGuests={data.includedGuests');
    });
  }
});
