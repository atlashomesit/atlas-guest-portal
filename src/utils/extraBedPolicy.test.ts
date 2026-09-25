import { describe, it, expect } from 'vitest';
import {
  billableGuestsForBedding,
  extraBedsRequired,
  extraBedNightsTotal,
  shouldChargeExtraBed,
} from './extraBedPolicy';

/**
 * TASK-102396 — infants under 2 stay free; no extra-bed fee for them.
 * Board case: 2 Adults + 1 infant must NOT add the ₹1,500/night surcharge.
 */
describe('extraBedPolicy — TASK-102396 infants stay free', () => {
  it('2 adults + 1 infant within capacity triggers no extra-bed fee', () => {
    const counts = { adults: 2, children: 0, infants: 1 };
    expect(billableGuestsForBedding(counts)).toBe(2);
    expect(extraBedsRequired(counts, 2)).toBe(0);
    expect(shouldChargeExtraBed(counts, 2)).toBe(false);
    expect(extraBedNightsTotal(counts, 2, 1500, 3)).toBe(0);
  });

  it('infants never count toward bedding even when many are present', () => {
    const counts = { adults: 2, children: 0, infants: 3 };
    expect(extraBedsRequired(counts, 2)).toBe(0);
    expect(shouldChargeExtraBed(counts, 2)).toBe(false);
  });

  it('children and adults over capacity still trigger the fee', () => {
    expect(shouldChargeExtraBed({ adults: 2, children: 1, infants: 1 }, 2)).toBe(true);
    expect(extraBedsRequired({ adults: 2, children: 1, infants: 1 }, 2)).toBe(1);
    expect(extraBedNightsTotal({ adults: 3, children: 0, infants: 0 }, 2, 1500, 2)).toBe(3000);
  });

  it('clamps negative and fractional inputs', () => {
    expect(extraBedsRequired({ adults: -1, children: 0, infants: -2 }, 2)).toBe(0);
    expect(extraBedNightsTotal({ adults: 3, children: 0, infants: 0 }, 2, -1500, -2)).toBe(0);
  });
});
