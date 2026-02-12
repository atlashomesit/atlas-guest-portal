#!/usr/bin/env node

const isPages = process.env.CF_PAGES === '1' || Boolean(process.env.CF_PAGES_URL);
const branch = process.env.CF_PAGES_BRANCH || '';
const pagesUrl = process.env.CF_PAGES_URL || '';
const discount = process.env.VITE_GLOBAL_DISCOUNT_PERCENT;

const isLikelyProdPagesUrl = (() => {
  if (!pagesUrl) return false;

  try {
    const hostname = new URL(pagesUrl).hostname;
    if (!hostname.endsWith('.pages.dev')) {
      // Custom domains are typically attached to production.
      return true;
    }

    // Production default domain is usually <project>.pages.dev (3 labels).
    // Preview URLs are usually <branch-or-hash>.<project>.pages.dev (4+ labels).
    return hostname.split('.').length <= 3;
  } catch {
    return false;
  }
})();

const isProdDeployment = isPages && (branch === 'dev' || (!branch && isLikelyProdPagesUrl));

const viteKeys = Object.keys(process.env)
  .filter((key) => key.startsWith('VITE_'))
  .sort((a, b) => a.localeCompare(b));

console.log('=== Cloudflare Pages env verification ===');
console.log(`CF_PAGES=${process.env.CF_PAGES ?? '(not set)'}`);
console.log(`CF_PAGES_BRANCH=${branch || '(not set)'}`);
console.log(`CF_PAGES_URL=${pagesUrl || '(not set)'}`);
console.log(`isPages=${isPages}`);
console.log(`isProdDeployment=${isProdDeployment}`);
console.log(
  `VITE_GLOBAL_DISCOUNT_PERCENT=${discount && String(discount).trim() ? discount : 'NOT SET'}`,
);
console.log(`VITE_* keys (${viteKeys.length}): ${viteKeys.length ? viteKeys.join(', ') : '(none)'}`);

if (isProdDeployment && (!discount || !String(discount).trim())) {
  console.error('\nERROR: Missing required production env var: VITE_GLOBAL_DISCOUNT_PERCENT');
  console.error('This Pages deployment looks like Production for branch "dev".');
  console.error('Likely causes:');
  console.error('- Env var was edited in the wrong Pages project (multiple projects/domains).');
  console.error('- Env var was set only for Preview scope, not Production scope.');
  console.error('Fix:');
  console.error('- Confirm the correct Pages project serves your live domain.');
  console.error('- Set VITE_GLOBAL_DISCOUNT_PERCENT in Production environment variables.');
  console.error('- Trigger a fresh Production build from a new commit (do not only retry an older deployment).');
  process.exit(1);
}
