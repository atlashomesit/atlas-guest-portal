import { describe, it, expect } from 'vitest';
import { buildLuggageTicket, isLuggageInputValid } from './luggageStorage';

describe('TASK-102205 luggage storage toggle', () => {
  it('prompts for bags + window and validates the input', () => {
    expect(isLuggageInputValid({ bags: 2, windowLabel: '9 AM - 2 PM' })).toBe(true);
    expect(isLuggageInputValid({ bags: 0, windowLabel: '9 AM - 2 PM' })).toBe(false);
    expect(isLuggageInputValid({ bags: 2, windowLabel: '  ' })).toBe(false);
  });

  it('generates a digital baggage claim ticket', () => {
    const t = buildLuggageTicket('2026-10-01', '301', { bags: 2, windowLabel: '9 AM - 2 PM' });
    expect(t.ticketNo).toBe('LUG-20261001-301-2');
    expect(t.windowLabel).toBe('9 AM - 2 PM');
  });
});
