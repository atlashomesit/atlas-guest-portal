/**
 * GUEST-065 — a card line must never contradict the home. 101 and 301 are studios; their authored lines said
 * "Three bright bedrooms" and "a sunlit duplex", so they are gone and those cards use the listing's own text.
 */
import { describe, it, expect } from 'vitest';
import HOME_DESCRIPTORS, { getHomeDescriptor } from './homeDescriptors';

describe('homeDescriptors (GUEST-065)', () => {
  it('has no line for the two studios whose lines contradicted them', () => {
    expect(getHomeDescriptor('101')).toBeUndefined();
    expect(getHomeDescriptor(301)).toBeUndefined();
  });

  it('no remaining line claims bedrooms or a duplex', () => {
    const all = Object.values(HOME_DESCRIPTORS).join(' ');
    expect(all).not.toMatch(/\b(two|three|four|\d)\s+(bright\s+)?bedrooms?\b/i);
    expect(all).not.toMatch(/duplex/i);
  });

  it('keeps the lines that were not flagged', () => {
    expect(getHomeDescriptor('501')).toMatch(/rooftop/i);
    expect(getHomeDescriptor('102')).toBeDefined();
  });
});
