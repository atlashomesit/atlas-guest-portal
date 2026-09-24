import { describe, it, expect } from 'vitest';
import { AMENITY_CATALOG, buildAmenityDispatch, clampAmenityQty } from './amenityRequests';

describe('TASK-102200 amenity request catalog', () => {
  it('catalog cards carry pictures for the stepper UI', () => {
    for (const a of AMENITY_CATALOG) {
      expect(a.imageUrl.length).toBeGreaterThan(0);
      expect(a.maxQtyPerRequest).toBeGreaterThan(0);
    }
  });

  it('clamps stepper quantities to the per-item max', () => {
    expect(clampAmenityQty(AMENITY_CATALOG[0], 99)).toBe(4);
    expect(clampAmenityQty(AMENITY_CATALOG[0], -2)).toBe(0);
  });

  it('dispatches a live alert payload with room + 30-min SLA', () => {
    const d = buildAmenityDispatch('201', [{ amenityId: 'towels', qty: 2 }], 1000);
    expect(d.roomNumber).toBe('201');
    expect(d.lines).toEqual([{ amenityId: 'towels', qty: 2 }]);
    expect(d.slaDueAtMs).toBe(1000 + 30 * 60_000);
  });
});
