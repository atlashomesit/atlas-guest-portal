import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const expected = 'a8103d0e1234567890abcdef1234567890abcdef'; const root = mkdtempSync(path.join(tmpdir(), 'atlas-version-stamp-')); const output = path.join(root, 'configured-output'); const script = path.resolve('scripts/write-version-json.mjs');
function run(env = {}) { return execFileSync(process.execPath, [script], { cwd: root, env: { ...process.env, ...env }, stdio: 'pipe' }); }
function expectThrow(label, env, pattern) { try { run(env); } catch (error) { if (pattern.test(`${error.stdout ?? ''}\n${error.stderr ?? ''}\n${error.message}`)) return; throw new Error(`${label}: wrong error: ${error.message}`); } throw new Error(`${label}: expected generator to throw`); }
try {
  run({ ATLAS_BUILD_COMMIT_SHA: expected, ATLAS_BUILD_OUTPUT_DIR: output });
  const value = JSON.parse(readFileSync(path.join(output, 'version.json'), 'utf8'));
  if (value.commitSha !== expected) throw new Error(`expected ${expected}, got ${value.commitSha}`);
  if (existsSync(path.join(root, 'dist', 'version.json'))) throw new Error('version.json escaped configured output dir');
  for (const bad of ['', 'unknown', 'placeholder', 'not-hex', 'a'.repeat(39), 'a'.repeat(41)]) expectThrow(`invalid sha ${JSON.stringify(bad)}`, { ATLAS_BUILD_COMMIT_SHA: bad, ATLAS_BUILD_OUTPUT_DIR: output }, /invalid commit SHA/);
  const noGitEnv = { ...process.env, ATLAS_BUILD_OUTPUT_DIR: output, PATH: '' }; delete noGitEnv.ATLAS_BUILD_COMMIT_SHA; expectThrow('no git', noGitEnv, /spawnSync git ENOENT|not recognized/);
  console.log('write-version-json.self-test: PASS');
} finally { rmSync(root, { recursive: true, force: true }); }
