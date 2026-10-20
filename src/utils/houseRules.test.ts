import { describe, expect, it } from 'vitest';
import { parseStructuredHouseRules } from './houseRules';

describe('parseStructuredHouseRules (founder ruling 2026-10-19: show the host\'s own rules)', () => {
  it('turns the structured JSON into plain-language chips', () => {
    const chips = parseStructuredHouseRules(
      '{"smoking":false,"pets":true,"parties":false,"kidsWelcome":true,"quietHoursStart":"22:00","quietHoursEnd":"08:00"}',
    );
    expect(chips.map((c) => c.label)).toEqual([
      'No smoking',
      'Pets allowed',
      'No parties or events',
      'Kids welcome',
      'Quiet hours 22:00 to 08:00',
    ]);
    expect(chips.find((c) => c.key === 'smoking')?.tone).toBe('no');
    expect(chips.find((c) => c.key === 'pets')?.tone).toBe('ok');
    expect(chips.find((c) => c.key === 'quiet')?.tone).toBe('info');
  });

  it('says "not suitable for children" when kids are not welcome', () => {
    expect(parseStructuredHouseRules('{"kidsWelcome":false}').map((c) => c.label)).toEqual(['Not suitable for children']);
  });

  it('malformed, empty, null or non-object input yields no chips and never throws', () => {
    expect(parseStructuredHouseRules(null)).toEqual([]);
    expect(parseStructuredHouseRules('')).toEqual([]);
    expect(parseStructuredHouseRules('not json')).toEqual([]);
    expect(parseStructuredHouseRules('[1,2]')).toEqual([]);
    expect(parseStructuredHouseRules('{}')).toEqual([]);
    expect(parseStructuredHouseRules('{"quietHoursStart":"late"}')).toEqual([]);
  });
});
