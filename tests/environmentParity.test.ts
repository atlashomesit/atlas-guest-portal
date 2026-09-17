import { describe, it, expect } from 'vitest';
import { isProductionEnvironment as isProductionEnvironmentFunctions } from '../functions/_lib/environment';
import { isProductionEnvironment as isProductionEnvironmentSrc } from '../src/runtime-config/environment';

/**
 * TASK-7866 fix (prod-environment-indexing, 2026-09-17): functions/_lib/environment.ts and
 * src/runtime-config/environment.ts are deliberately two separate files (functions/ cannot
 * import from src/ in this repo's build — see either file's header for why), which means
 * nothing but a test stops them from drifting apart. This file is that test: it runs the exact
 * same truth table against both copies and fails the moment either one disagrees with the other,
 * or with the intended rule (trimmed, case-insensitive "" / "production" / "prod" = production).
 */
describe('isProductionEnvironment: functions/_lib and src/runtime-config stay identical (TASK-7866)', () => {
  const truthTable: Array<[string | null | undefined, boolean]> = [
    ['', true],
    ['production', true],
    ['prod', true],
    ['PROD', true],
    ['Production', true],
    ['  prod  ', true],
    ['  PRODUCTION  ', true],
    [undefined, true],
    [null, true],
    ['qa', false],
    ['dev', false],
    ['staging', false],
    ['local', false],
    ['productionx', false],
    ['prod-2', false],
    ['non-production', false],
  ];

  it.each(truthTable)('both copies agree that %j -> production=%s', (value, expected) => {
    expect(isProductionEnvironmentFunctions(value)).toBe(expected);
    expect(isProductionEnvironmentSrc(value)).toBe(expected);
  });

  it('both copies agree on every value in the truth table, pairwise', () => {
    for (const [value] of truthTable) {
      expect(isProductionEnvironmentFunctions(value)).toBe(isProductionEnvironmentSrc(value));
    }
  });
});
