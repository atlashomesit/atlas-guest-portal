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

  // PAY-004: when the bank or gateway is the problem, the guest is pointed at another way to pay.
  it('suggests a UPI QR code or another bank for SERVER_ERROR, GATEWAY_ERROR and an expired UPI request', () => {
    expect(mapRazorpayFailureCode('SERVER_ERROR')).toMatch(/UPI QR/i);
    expect(mapRazorpayFailureCode('SERVER_ERROR')).toMatch(/another bank/i);
    expect(mapRazorpayFailureCode('SERVER_ERROR')).toMatch(/contact .+@/i);
    expect(mapRazorpayFailureCode('GATEWAY_ERROR')).toMatch(/UPI QR/i);
    expect(mapRazorpayFailureCode('GATEWAY_ERROR')).toMatch(/another bank/i);
    expect(mapRazorpayFailureCode('BAD_REQUEST_ERROR', 'UPI collect request expired')).toMatch(/UPI QR/i);
    expect(mapRazorpayFailureCode('BAD_REQUEST_ERROR', 'Payment expired')).toMatch(/ran out of time/i);
    expect(mapRazorpayFailureCode(undefined, 'Collect request timed out')).toMatch(/UPI QR/i);
  });

  it('leaves other declines and descriptions alone', () => {
    expect(mapRazorpayFailureCode('BAD_REQUEST_ERROR', 'Card declined')).toMatch(/declined/i);
    expect(mapRazorpayFailureCode(undefined, 'Your bank did not approve it.')).toBe('Your bank did not approve it.');
  });
});
