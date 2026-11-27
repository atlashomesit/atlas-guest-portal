import { describe, it, expect } from 'vitest';
import { resolveActiveHappyHourPrice } from './happyHourPricing';

describe('POS-152 resolveActiveHappyHourPrice', () => {
  const windows = [
    {
      id: 'hh-1',
      label: 'Weekday Happy Hour 20% Off',
      daysOfWeek: [1, 2, 3, 4, 5],
      startMinuteOfDay: 16 * 60,
      endMinuteOfDay: 19 * 60,
      discountPct: 20,
    },
  ];

  it('applies happy hour discount during active weekday window', () => {
    const wednesday5pm = new Date(2026, 11, 2, 17, 0); // Wed Dec 2 2026 17:00
    const res = resolveActiveHappyHourPrice(500, windows, wednesday5pm);
    expect(res.finalPriceInr).toBe(400);
    expect(res.activeWindow?.id).toBe('hh-1');
  });

  it('keeps base price outside window', () => {
    const wednesday9pm = new Date(2026, 11, 2, 21, 0);
    const res = resolveActiveHappyHourPrice(500, windows, wednesday9pm);
    expect(res.finalPriceInr).toBe(500);
    expect(res.activeWindow).toBeNull();
  });
});
