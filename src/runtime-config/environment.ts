/**
 * TASK-7866 fix (prod-environment-indexing, 2026-09-17): single source of truth for "is this
 * runtime config production" on the Vite/browser side.
 *
 * Root cause: every production Cloudflare Pages host sets ATLAS_ENVIRONMENT to the literal
 * string "prod" (verified with GET /.well-known/atlas-runtime-config.json on atlashomestays.com,
 * www.atlashomestays.com, atlashomes.in, www.atlashomes.in, atlastays.com, www.atlastays.com and
 * millionairesmansion.atlastays.com — all returned `"environment": "prod"`, which flows into
 * `AtlasRuntimeConfig.environment` unchanged via `loadRuntimeConfig()`). The check that used to
 * read this value inline (`env !== 'production'`) only recognised the exact string "production",
 * so every real prod host was treated as non-production and got a client-side noindex tag.
 *
 * `functions/_lib/environment.ts` holds an identical twin for the Pages Functions side (see that
 * file's header for why the two aren't shared). tests/environmentParity.test.ts imports both
 * copies and asserts they agree on the same truth table so they cannot silently drift apart.
 */
export function isProductionEnvironment(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "" || normalized === "production" || normalized === "prod";
}
