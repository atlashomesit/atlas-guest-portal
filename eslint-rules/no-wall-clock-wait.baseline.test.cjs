/**
 * Pins the ratchet in eslint-rules/no-wall-clock-wait.baseline.json (TASK-102734).
 *
 * The rule itself fails on excess AND on a stale (too-high) entry, so the JSON can never sit above reality. What the
 * rule cannot see is someone raising a number or adding a file to make a red go away; this test makes that a
 * two-file, reviewable edit. Lowering CEILING / shrinking FROZEN_FILES is always fine; raising either is the
 * anti-pattern this task removed.
 *
 * Run with: npx vitest run eslint-rules/no-wall-clock-wait.baseline.test.cjs
 */
const fs = require('fs');
const path = require('path');

const baselinePath = path.join(__dirname, 'no-wall-clock-wait.baseline.json');
const repoRoot = path.resolve(__dirname, '..');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const files = baseline.files;

// The files that were listed when the rule was introduced. A file may leave this list, never join it.
const FROZEN_FILES = [
  'src/App.a11y.test.tsx',
  'tests/PropertyDetailsMedia.test.tsx',
  'tests/propertyDetailsRouteSmoke.test.tsx',
];
// The total tolerated when the rule was introduced (2026-09-30). Only ever lower it.
const CEILING = 8;

describe('no-wall-clock-wait baseline ratchet', () => {
  it('lists only files that were already listed at introduction (new files start at zero)', () => {
    const extra = Object.keys(files).filter((f) => !FROZEN_FILES.includes(f));
    expect(extra).toEqual([]);
  });

  it('never tolerates more than the introduction total', () => {
    const total = Object.values(files).reduce((sum, n) => sum + n, 0);
    expect(total).toBeLessThanOrEqual(CEILING);
  });

  it('holds only positive integers (a cleared file is deleted, not set to 0)', () => {
    for (const [file, n] of Object.entries(files)) {
      expect(Number.isInteger(n) && n >= 1, `${file} = ${n}`).toBe(true);
    }
  });

  it('points only at files that exist (a deleted file must leave the list)', () => {
    for (const file of Object.keys(files)) {
      expect(fs.existsSync(path.join(repoRoot, file)), `${file} is listed but missing`).toBe(true);
    }
  });
});
