import { describe, it, expect } from 'vitest';
import { buildLodgingJsonLd, lodgingJsonLdScript } from './lodgingJsonLd';

const INPUT = {
  name: 'Sunset Villa', url: 'https://stays.example.com/villas/sunset',
  imageUrl: 'https://stays.example.com/img/sunset.jpg', streetAddress: '1 Beach Rd',
  city: 'Goa', priceCurrency: 'INR', lowPriceInr: 8000, highPriceInr: 14000,
  averageRating: 4.7, reviewCount: 132, amenities: ['Pool', 'WiFi'],
};

describe('TASK-102260 lodging JSON-LD generator', () => {
  it('emits Hotel + LodgingBusiness types with postal address', () => {
    const ld = buildLodgingJsonLd(INPUT);
    expect(ld['@type']).toEqual(['Hotel', 'LodgingBusiness']);
    expect(ld.address).toMatchObject({ '@type': 'PostalAddress', addressCountry: 'IN' });
  });

  it('includes aggregate rating and amenity features, serializable as a script', () => {
    const ld = buildLodgingJsonLd(INPUT);
    expect(ld.aggregateRating).toMatchObject({ ratingValue: 4.7, reviewCount: 132 });
    expect(() => JSON.parse(lodgingJsonLdScript(INPUT))).not.toThrow();
  });

  it('omits aggregateRating when there are no reviews', () => {
    const ld = buildLodgingJsonLd({ ...INPUT, averageRating: undefined, reviewCount: 0 });
    expect('aggregateRating' in ld).toBe(false);
  });
});
