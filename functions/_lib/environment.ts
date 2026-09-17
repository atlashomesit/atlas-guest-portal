/**
 * TASK-7866 fix (prod-environment-indexing, 2026-09-17): single source of truth for "is this
 * request running in production" on the Pages Functions side.
 *
 * Root cause: every production Cloudflare Pages host sets ATLAS_ENVIRONMENT to the literal
 * string "prod" (verified with GET /.well-known/atlas-runtime-config.json on atlashomestays.com,
 * www.atlashomestays.com, atlashomes.in, www.atlashomes.in, atlastays.com, www.atlastays.com and
 * millionairesmansion.atlastays.com — all returned `"environment": "prod"`). The two checks that
 * used to read this value inline only recognised an empty value or the exact string
 * "production", so every real prod host was treated as non-production.
 *
 * This does NOT change the Cloudflare Pages ATLAS_ENVIRONMENT variable (still "prod") — it
 * changes what counts as "production" when reading it.
 *
 * `src/runtime-config/environment.ts` holds an identical twin for the Vite/browser side.
 * The two are NOT shared: nothing under functions/ has ever imported from src/ in this repo,
 * tsconfig.app.json's `include` is `["src"]` only (functions/ is not part of `npm run
 * typecheck`), and the wrangler Pages Functions bundle has no `@/` alias configured — so a
 * functions/ -> src/ import would be an unprecedented, unverified cross-runtime dependency to
 * add in an unattended overnight fix. tests/environmentParity.test.ts imports both copies and
 * asserts they agree on the same truth table so they cannot silently drift apart.
 */
export function isProductionEnvironment(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "" || normalized === "production" || normalized === "prod";
}
