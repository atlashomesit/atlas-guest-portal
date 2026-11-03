import { describe, expect, it } from 'vitest';
import {
  PRICING_NOT_CONFIGURED_CODE,
  PRICING_NOT_CONFIGURED_FALLBACK_MESSAGE,
  PricingNotConfiguredError,
  isPricingNotConfiguredError,
  pricingNotConfiguredMessage,
} from './pricingNotConfigured';

/**
 * FOUNDER-RULED 2026-11-03: a room whose host has not set pricing answers HTTP 409
 * { code: "PRICING_NOT_CONFIGURED", message: "This room can't be booked online yet. Please contact the host." }.
 * The guest portal recognises it by status AND code, never by wording.
 */
describe('pricingNotConfiguredMessage', () => {
  const API_MESSAGE = "This room can't be booked online yet. Please contact the host.";

  it('returns the API\'s own sentence for the 409 with the code', () => {
    expect(pricingNotConfiguredMessage(409, { code: PRICING_NOT_CONFIGURED_CODE, message: API_MESSAGE })).toBe(API_MESSAGE);
  });

  it('falls back to the same sentence when the answer carries the code but no message', () => {
    expect(pricingNotConfiguredMessage(409, { code: PRICING_NOT_CONFIGURED_CODE })).toBe(PRICING_NOT_CONFIGURED_FALLBACK_MESSAGE);
    expect(pricingNotConfiguredMessage(409, { code: PRICING_NOT_CONFIGURED_CODE, message: '   ' })).toBe(PRICING_NOT_CONFIGURED_FALLBACK_MESSAGE);
  });

  it('tolerates the PascalCase body the rest of the portal tolerates', () => {
    expect(pricingNotConfiguredMessage(409, { Code: PRICING_NOT_CONFIGURED_CODE, Message: API_MESSAGE })).toBe(API_MESSAGE);
  });

  it('is NOT any other 409 (dates just taken, a stay rule, a duplicate payment)', () => {
    expect(pricingNotConfiguredMessage(409, { code: 'AVAILABILITY_CONFLICT', message: 'Those dates were just taken.' })).toBeNull();
    expect(pricingNotConfiguredMessage(409, { code: 'STAY_RULE_REFUSED', message: 'Minimum stay is 2 night(s).' })).toBeNull();
    expect(pricingNotConfiguredMessage(409, { message: API_MESSAGE })).toBeNull(); // the wording alone is never enough
  });

  it('needs the 409 status as well as the code', () => {
    expect(pricingNotConfiguredMessage(400, { code: PRICING_NOT_CONFIGURED_CODE, message: API_MESSAGE })).toBeNull();
    expect(pricingNotConfiguredMessage(500, { code: PRICING_NOT_CONFIGURED_CODE, message: API_MESSAGE })).toBeNull();
    expect(pricingNotConfiguredMessage(undefined, { code: PRICING_NOT_CONFIGURED_CODE })).toBeNull();
  });

  it('is null for a body that is not an object', () => {
    expect(pricingNotConfiguredMessage(409, null)).toBeNull();
    expect(pricingNotConfiguredMessage(409, undefined)).toBeNull();
    expect(pricingNotConfiguredMessage(409, 'PRICING_NOT_CONFIGURED')).toBeNull();
  });
});

describe('PricingNotConfiguredError', () => {
  it('is an Error carrying the code, and is recognised by the guard', () => {
    const err = new PricingNotConfiguredError('This room can\'t be booked online yet. Please contact the host.');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(PRICING_NOT_CONFIGURED_CODE);
    expect(err.message).toBe('This room can\'t be booked online yet. Please contact the host.');
    expect(isPricingNotConfiguredError(err)).toBe(true);
  });

  it('does not mistake an ordinary error for it', () => {
    expect(isPricingNotConfiguredError(new Error('Could not load pricing.'))).toBe(false);
    expect(isPricingNotConfiguredError('PRICING_NOT_CONFIGURED')).toBe(false);
    expect(isPricingNotConfiguredError(null)).toBe(false);
  });
});
