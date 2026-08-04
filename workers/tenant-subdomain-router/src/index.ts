/**
 * TASK-7170 / ADR-0096: `tenant-subdomain-router` — a deliberately logic-free passthrough
 * Worker attached to route `*.atlastays.com/*` on the atlastays.com zone.
 *
 * Cloudflare Pages rejects wildcard custom domains, so tenant direct-booking sites
 * (`<slug>.atlastays.com`) cannot be bound to the `atlas-guest-portal` Pages project
 * per-tenant. This Worker closes the gap: it fetches the same path+query on the Pages origin
 * and returns the response untouched. All tenant resolution stays where it already lives —
 * the SPA (`src/tenant/tenantContext.ts`), the TASK-4905 OG/meta Pages Function
 * (`functions/_middleware.ts`, which prefers `X-Forwarded-Host`), and atlas-api's
 * `TenantProvider.ResolveTenantFromHostAsync` — so this Worker's only failure modes are
 * Cloudflare-platform failures, not Atlas-code failures.
 *
 * LOOP GUARD (hard requirement, ADR-0096): the origin fetch must NOT carry
 * `Host: <slug>.atlastays.com`. atlastays.com is a Cloudflare zone whose wildcard route
 * points back at this Worker — forwarding the public Host would loop every request forever.
 * The public host is conveyed exclusively via `X-Forwarded-Host` / `X-Public-Origin`.
 *
 * Reserved slugs (`www`, `admin`, `api`, …) need NO handling here: the API's
 * `ReservedSlugs.All` short-circuits them to the Atlas default (verified against
 * `atlas-api/Atlas.Api/Services/Tenancy/TenantProvider.cs`, `TryResolveFromSubdomainAsync`).
 *
 * Unit contract: `tests/tenantSubdomainRouter.test.ts`.
 */

// The existing Pages project origin. Fixed at deploy time — pages.dev domains serve the Pages
// project directly and are not zone-routed, so fetching this origin can never re-enter the
// atlastays.com wildcard route.
const PAGES_ORIGIN = "https://atlas-guest-portal.pages.dev";

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const publicHost = incoming.host;

    const originUrl = new URL(incoming.pathname + incoming.search, PAGES_ORIGIN);

    const headers = new Headers(request.headers);
    headers.delete("host"); // loop guard — never let the public Host reach the origin fetch
    headers.set("X-Forwarded-Host", publicHost);
    headers.set("X-Public-Origin", `${incoming.protocol}//${publicHost}`);

    // Explicit init instead of the canonical `new Request(originUrl, request)` shortcut:
    // Request-as-init propagation is runtime-dependent (workerd preserves method/body; the
    // undici+jsdom mix under vitest silently drops both), and this Worker must behave
    // identically under the unit-test runtime and in production. Only method/headers/body
    // need to survive the hop — nothing downstream reads `cf`/`signal`.
    const init: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
    };
    if (request.body !== null) {
      init.body = request.body;
      init.duplex = "half"; // undici requirement for stream bodies; workerd ignores the key
    }

    return fetch(new Request(originUrl.toString(), init));
  },
};
