/**
 * TASK-7430: dynamic robots.txt so Sitemap: always points at this origin's /sitemap.xml
 * (static public/robots.txt hardcodes atlastays.com and is wrong on tenant custom domains).
 *
 * TASK-7866: non-production environments (qa, dev) serve Disallow: / to prevent Google
 * from indexing duplicate listing content that competes with the production booking funnel.
 * The environment is read from ATLAS_ENVIRONMENT (same env var as atlas-runtime-config.json).
 */

import { isNoindexHost } from "./_lib/noindexHosts";

interface Env {
  ATLAS_ENVIRONMENT?: string;
}

const PRODUCTION_BODY = (sitemapUrl: string) => `User-agent: *
Allow: /
Sitemap: ${sitemapUrl}

# AI search crawlers — explicitly allow for GEO visibility
User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Bytespider
Allow: /
`;

// TASK-7866: non-production environments block all crawlers.
const NON_PRODUCTION_BODY = `# TASK-7866: non-production environment — do not index.
# This host carries real listing data that would compete with production if indexed.
User-agent: *
Disallow: /
`;

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const environment = (env.ATLAS_ENVIRONMENT ?? "").trim().toLowerCase();
  const isProduction = !environment || environment === "production";

  const url = new URL(request.url);
  const origin = url.origin.replace(/\/+$/, "");
  // An internal-tenant demo host is suppressed even in production — see _lib/noindexHosts.
  const suppressed = isNoindexHost(url.hostname);

  const body = isProduction && !suppressed
    ? PRODUCTION_BODY(`${origin}/sitemap.xml`)
    : NON_PRODUCTION_BODY;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
