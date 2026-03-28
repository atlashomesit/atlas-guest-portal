#!/usr/bin/env node
/**
 * Cloudflare Pages build env diagnostics.
 * API base URL and global discount come from runtime config (/.well-known/atlas-runtime-config.json),
 * not from VITE_* build-time vars, so no env vars are required for the app to work.
 */

const isPages = process.env.CF_PAGES === '1' || Boolean(process.env.CF_PAGES_URL);
const branch = process.env.CF_PAGES_BRANCH || '';
const pagesUrl = process.env.CF_PAGES_URL || '';

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
console.log(`VITE_* keys (${viteKeys.length}): ${viteKeys.length ? viteKeys.join(', ') : '(none)'}`);
console.log('(apiBaseUrl and globalDiscountPercent are loaded from runtime config at app startup)');
