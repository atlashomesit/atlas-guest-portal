import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function resolveCommitSha() {
  const supplied = (process.env.ATLAS_BUILD_COMMIT_SHA ?? '').trim();
  const commitSha = supplied || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new Error(`Refusing to emit version.json with invalid commit SHA: ${commitSha || '<empty>'}`);
  }
  return commitSha.toLowerCase();
}

const outputDir = process.env.ATLAS_BUILD_OUTPUT_DIR ?? 'dist';
mkdirSync(outputDir, { recursive: true });
writeFileSync(path.join(outputDir, 'version.json'), `${JSON.stringify({ commitSha: resolveCommitSha() })}\n`, 'utf8');
