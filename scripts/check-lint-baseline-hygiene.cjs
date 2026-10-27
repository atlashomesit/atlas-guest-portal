#!/usr/bin/env node
/**
 * TASK-109007: Lint baseline hygiene check for atlas-guest-portal.
 *
 * Verifies that every file listed in eslint-rules/*.baseline.json:
 *  1. Exists on disk
 *  2. Has allowed count > 0 (stale entries with 0 violations must be removed)
 *
 * Usage:
 *   node scripts/check-lint-baseline-hygiene.cjs             # check
 *   node scripts/check-lint-baseline-hygiene.cjs --prune     # prune missing or zero-count files
 *   node scripts/check-lint-baseline-hygiene.cjs --self-test # selftest
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.env.LINT_BASELINE_HYGIENE_ROOT || path.resolve(__dirname, '..');
const ESLINT_RULES_DIR = path.join(ROOT, 'eslint-rules');

function getBaselineFiles(rulesDir = ESLINT_RULES_DIR) {
  if (!fs.existsSync(rulesDir)) return [];
  return fs.readdirSync(rulesDir)
    .filter((f) => f.endsWith('.baseline.json'))
    .map((f) => path.join(rulesDir, f));
}

function auditBaselines(rootDir = ROOT) {
  const rulesDir = path.join(rootDir, 'eslint-rules');
  const baselineFiles = getBaselineFiles(rulesDir);
  const issues = [];

  for (const bFile of baselineFiles) {
    const relBase = path.relative(rootDir, bFile);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(bFile, 'utf8'));
    } catch (err) {
      issues.push({ file: relBase, issue: `Parse error: ${err.message}` });
      continue;
    }

    if (!parsed || typeof parsed.files !== 'object' || !parsed.files) continue;

    for (const [entryFile, count] of Object.entries(parsed.files)) {
      const fullPath = path.join(rootDir, entryFile);
      if (!fs.existsSync(fullPath)) {
        issues.push({ baseline: relBase, entry: entryFile, issue: 'file does not exist on disk' });
      } else if (typeof count === 'number' && count <= 0) {
        issues.push({ baseline: relBase, entry: entryFile, issue: `allowed count is ${count} (stale entry, delete it)` });
      }
    }
  }

  return issues;
}

function pruneBaselines(rootDir = ROOT) {
  const rulesDir = path.join(rootDir, 'eslint-rules');
  const baselineFiles = getBaselineFiles(rulesDir);
  let prunedCount = 0;

  for (const bFile of baselineFiles) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(bFile, 'utf8'));
    } catch {
      continue;
    }
    if (!parsed || typeof parsed.files !== 'object' || !parsed.files) continue;

    let modified = false;
    const newFiles = {};
    for (const [entryFile, count] of Object.entries(parsed.files)) {
      const fullPath = path.join(rootDir, entryFile);
      if (!fs.existsSync(fullPath)) {
        console.log(`[lint-baseline-hygiene] Pruned missing file: ${entryFile} from ${path.basename(bFile)}`);
        modified = true;
        prunedCount++;
      } else if (typeof count === 'number' && count <= 0) {
        console.log(`[lint-baseline-hygiene] Pruned zero-count file: ${entryFile} from ${path.basename(bFile)}`);
        modified = true;
        prunedCount++;
      } else {
        newFiles[entryFile] = count;
      }
    }

    if (modified) {
      parsed.files = newFiles;
      fs.writeFileSync(bFile, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    }
  }

  return prunedCount;
}

function runSelfTest() {
  console.log('[lint-baseline-hygiene.self-test] Running synthetic test...');
  const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-lint-baseline-hygiene-'));
  try {
    const rulesDir = path.join(tmp, 'eslint-rules');
    fs.mkdirSync(rulesDir, { recursive: true });

    const baselineData = {
      files: {
        'src/non-existent.test.ts': 2,
        'src/zero.test.ts': 0,
      },
    };
    fs.writeFileSync(path.join(rulesDir, 'test.baseline.json'), JSON.stringify(baselineData, null, 2));

    const issues = auditBaselines(tmp);
    if (issues.length !== 2) {
      console.error(`FAIL: expected 2 issues, got ${issues.length}`);
      process.exit(1);
    }
    console.log('  ok: missing and zero-count files detected');

    const pruned = pruneBaselines(tmp);
    if (pruned !== 2) {
      console.error(`FAIL: expected 2 pruned entries, got ${pruned}`);
      process.exit(1);
    }

    const issuesAfter = auditBaselines(tmp);
    if (issuesAfter.length !== 0) {
      console.error(`FAIL: expected 0 issues after prune, got ${issuesAfter.length}`);
      process.exit(1);
    }
    console.log('  ok: prune cleaned all stale entries');
    console.log('[lint-baseline-hygiene.self-test] PASS');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    runSelfTest();
    return 0;
  }

  if (args.includes('--prune')) {
    const count = pruneBaselines(ROOT);
    console.log(`[lint-baseline-hygiene] Pruned ${count} stale baseline entry/entries.`);
    return 0;
  }

  const issues = auditBaselines(ROOT);
  if (issues.length > 0) {
    console.error('[lint-baseline-hygiene] FAIL — found stale baseline entries:');
    for (const err of issues) {
      console.error(`  ${err.baseline}: ${err.entry} (${err.issue})`);
    }
    console.error('\nRun `node scripts/check-lint-baseline-hygiene.cjs --prune` to remove them.');
    return 1;
  }

  console.log('[lint-baseline-hygiene] OK — all eslint baseline entries exist and have positive counts.');
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { auditBaselines, pruneBaselines };
