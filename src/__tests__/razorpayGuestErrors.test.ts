import { describe, expect, it } from 'vitest';

import { mapRazorpayFailureCode } from '../utils/razorpayGuestErrors';

describe('mapRazorpayFailureCode (TASK-1469)', () => {
  it('maps known Razorpay codes', () => {
    expect(mapRazorpayFailureCode('BAD_REQUEST_ERROR')).toMatch(/declined/i);
    expect(mapRazorpayFailureCode('USER_CANCELLED')).toMatch(/cancelled/i);
    expect(mapRazorpayFailureCode('SERVER_ERROR')).toMatch(/contact .+@/i);
  });

  it('falls back to description then generic', () => {
    expect(mapRazorpayFailureCode(undefined, 'Custom bank message')).toBe('Custom bank message');
    expect(mapRazorpayFailureCode('UNKNOWN_CODE')).toMatch(/could not be completed/i);
  });
});
