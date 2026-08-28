import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const expected = 'a8103d0e1234567890abcdef1234567890abcdef';
const output = mkdtempSync(path.join(tmpdir(), 'atlas-version-stamp-'));
try {
  execFileSync(process.execPath, ['scripts/write-version-json.mjs'], {
    env: { ...process.env, ATLAS_BUILD_COMMIT_SHA: expected, ATLAS_BUILD_OUTPUT_DIR: output }, stdio: 'inherit'
  });
  const value = JSON.parse(readFileSync(path.join(output, 'version.json'), 'utf8'));
  if (value.commitSha !== expected) throw new Error(`expected ${expected}, got ${value.commitSha}`);
  console.log('write-version-json.self-test: PASS');
} finally { rmSync(output, { recursive: true, force: true }); }
