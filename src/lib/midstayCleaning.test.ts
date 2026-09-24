import { describe, it, expect } from 'vitest';
import { buildCleaningConfirmation, isCleaningDateEligible, isCleaningSlot } from './midstayCleaning';

describe('TASK-102204 mid-stay cleaning scheduler', () => {
  it('accepts only the offered time windows', () => {
    expect(isCleaningSlot('10:00-12:00')).toBe(true);
    expect(isCleaningSlot('14:00-16:00')).toBe(true);
    expect(isCleaningSlot('18:00-20:00')).toBe(false);
  });

  it('restricts bookings to nights inside the stay', () => {
    expect(isCleaningDateEligible('2026-10-03', '2026-10-01', '2026-10-06')).toBe(true);
    expect(isCleaningDateEligible('2026-10-06', '2026-10-01', '2026-10-06')).toBe(false);
    expect(isCleaningDateEligible('not-a-date', '2026-10-01', '2026-10-06')).toBe(false);
  });

  it('builds the guest confirmation with the assigned window', () => {
    expect(
      buildCleaningConfirmation({ roomNumber: '301', dateIso: '2026-10-03', slot: '10:00-12:00', instructions: 'Pet in room' }),
    ).toBe('Room 301 cleaning booked 2026-10-03, 10:00-12:00 (Pet in room).');
  });
});
