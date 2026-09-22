import { describe, it, expect } from 'vitest';
import { isProductionEnvironment } from './environment';

describe('isProductionEnvironment (src/runtime-config, TASK-7866)', () => {
  it.each([
    ['', 'unset'],
    ['production', 'the literal word'],
    ['prod', 'the real value Cloudflare Pages sets on prod hosts'],
    ['PROD', 'uppercase'],
    ['Production', 'mixed case'],
    ['  prod  ', 'padded with whitespace'],
    ['  PRODUCTION  ', 'padded and uppercase'],
  ])('treats %j (%s) as production', (value) => {
    expect(isProductionEnvironment(value)).toBe(true);
  });

  it('treats undefined as production (unset = production)', () => {
    expect(isProductionEnvironment(undefined)).toBe(true);
  });

  it('treats null as production (unset = production)', () => {
    expect(isProductionEnvironment(null)).toBe(true);
  });

  it.each([
    ['qa', 'the qa train environment'],
    ['dev', 'the dev train environment'],
    ['staging', 'an unrecognised value'],
    ['local', 'a local dev value'],
    ['productionx', 'a near-miss typo'],
    ['prod-2', 'a near-miss typo'],
    ['non-production', 'an explicit non-production label'],
  ])('treats %j (%s) as non-production', (value) => {
    expect(isProductionEnvironment(value)).toBe(false);
  });
});
